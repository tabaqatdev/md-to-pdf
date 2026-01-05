import { opfs, type FileNode } from '$lib/utils/opfs';
import { historyStore } from './history.svelte';
import { loroStore } from './loro.svelte';

export interface EditorFile {
	id: string;
	path: string;
	name: string;
	content: string;
	isDirty: boolean;
	isNew: boolean;
}

const LAST_FILE_KEY = 'md-to-pdf-last-file';
const AUTO_SAVE_DELAY_MS = 2000; // Auto-save after 2 seconds of inactivity

function createFilesStore() {
	let files = $state<FileNode[]>([]);
	let currentFile = $state<EditorFile | null>(null);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let autoSaveEnabled = $state(true);
	let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
	let lastSavedContent = '';

	// Track if we are currently applying a remote update to prevent loop
	let isApplyingRemote = false;

	async function init() {
		isLoading = true;
		error = null;
		try {
			await opfs.init();
			await historyStore.init();
			await refresh();

			// Restore last opened file
			const lastFilePath = localStorage.getItem(LAST_FILE_KEY);
			if (lastFilePath) {
				try {
					await openFile(lastFilePath);
				} catch {
					// File might have been deleted, clear the stored path
					localStorage.removeItem(LAST_FILE_KEY);
				}
			}

			// Setup beforeunload handler for auto-save
			if (typeof window !== 'undefined') {
				window.addEventListener('beforeunload', handleBeforeUnload);
			}

			// Setup Loro Sync
			setupLoroSync();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to initialize file system';
			console.error('Files store init error:', e);
		} finally {
			isLoading = false;
		}
	}

	function setupLoroSync() {
		loroStore.setChangeCallback(async () => {
			console.log('[FilesStore] Remote change detected, syncing to OPFS...');
			isApplyingRemote = true;
			try {
				const remoteFiles = loroStore.listFiles();
				console.log('[FilesStore] Remote files from Loro:', remoteFiles);

				for (const path of remoteFiles) {
					const content = loroStore.getFile(path);
					if (content !== null) {
						console.log(
							`[FilesStore] Writing remote file to OPFS: ${path} (${content.length} chars)`
						);
						// Write to OPFS
						await opfs.writeFile(path, content);

						// If this is the currently open file, update editor content too!
						if (currentFile && currentFile.path === path) {
							if (currentFile.content !== content) {
								console.log(`[FilesStore] Updating currently open file: ${path}`);
								currentFile.content = content;
								lastSavedContent = content;
							}
						}
					}
				}
				// TODO: Handle deletions via diff if needed
				await refresh();
				console.log('[FilesStore] Remote sync complete, file tree refreshed');
			} catch (e) {
				console.error('[FilesStore] Error applying remote changes:', e);
			} finally {
				isApplyingRemote = false;
			}
		});

		// Listen for becoming host to trigger initial sync
		loroStore.setHostCallback(async () => {
			console.log(
				'[FilesStore] LoroStore is now HOST. Triggering initial sync from local files...'
			);
			// Refresh list first to ensure we have latest local state
			const newFiles = await opfs.listDirectory();
			files = [...newFiles];

			if (files.length > 0) {
				await syncAllToLoro(files);
				console.log('[FilesStore] Initial sync complete.');
			} else {
				console.log('[FilesStore] No local files to sync.');
			}
		});
	}

	function handleBeforeUnload(event: BeforeUnloadEvent) {
		if (currentFile?.isDirty && !currentFile.isNew) {
			event.preventDefault();
			event.returnValue = '';
			saveCurrentFile();
		}
	}

	async function refresh() {
		try {
			const newFiles = await opfs.listDirectory();
			files = [...newFiles];
			console.log(
				'Refresh complete, files:',
				files.map((f) => f.name)
			);

			// Also sync LOCAL files to Loro if acting as Host and Loro is empty
			const loroFilesLength = loroStore.listFiles().length;
			console.log(
				'[FilesStore] Checking sync eligibility. Host?',
				loroStore.isHost,
				'Loro Files:',
				loroFilesLength,
				'Local Files:',
				files.length
			);

			if (loroStore.isHost && loroFilesLength === 0 && files.length > 0) {
				console.log('[FilesStore] Host initializing Loro store from local files...');
				await syncAllToLoro(files);
			} else {
				console.log(
					'[FilesStore] Skipping initial sync. Conditions met?',
					loroStore.isHost && loroFilesLength === 0 && files.length > 0
				);
			}
		} catch (e) {
			console.error('Failed to refresh files:', e);
			files = [];
		}
	}

	async function syncAllToLoro(nodes: FileNode[]) {
		for (const node of nodes) {
			if (node.type === 'file') {
				const content = await opfs.readFile(node.path);
				loroStore.setFile(node.path, content);
			} else if (node.children) {
				await syncAllToLoro(node.children);
			}
		}
	}

	async function createFile(path: string, name: string): Promise<string> {
		const fullPath = path ? `${path}/${name}` : name;
		const filePath = fullPath.endsWith('.md') ? fullPath : `${fullPath}.md`;

		await opfs.createFile(filePath, '');

		// Sync to Loro
		loroStore.setFile(filePath, '');

		await refresh();

		return filePath;
	}

	async function createFolder(path: string, name: string): Promise<void> {
		const fullPath = path ? `${path}/${name}` : name;
		await opfs.createFolder(fullPath);
		// Loro doesn't explicitly track empty folders in the map,
		// but we could add a placeholder or just wait for files.
		// For now, folders are local structural elements until a file is placed.
		await refresh();
	}

	async function openFile(path: string): Promise<void> {
		// Cancel any pending auto-save for previous file
		cancelAutoSave();

		if (currentFile?.isDirty) {
			// Auto-save before switching
			await saveCurrentFile();
		}

		isLoading = true;
		try {
			const content = await opfs.readFile(path);
			const name = path.split('/').pop() || 'Untitled';

			currentFile = {
				id: path,
				path,
				name,
				content,
				isDirty: false,
				isNew: false
			};

			// Notify Presence
			loroStore.setCurrentFile(path);

			lastSavedContent = content;

			// Remember the last opened file
			localStorage.setItem(LAST_FILE_KEY, path);

			// Load version history for this file
			await historyStore.loadVersions(path);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to open file';
		} finally {
			isLoading = false;
		}
	}

	async function saveCurrentFile(): Promise<void> {
		if (!currentFile || currentFile.isNew) return;
		// If we are applying remote, don't double save/broadcast
		if (isApplyingRemote) return;

		try {
			// Save version to history before overwriting (if content changed significantly)
			if (lastSavedContent && currentFile.content !== lastSavedContent) {
				await historyStore.saveVersion(currentFile.path, lastSavedContent);
			}

			await opfs.writeFile(currentFile.path, currentFile.content);

			// Sync to Loro
			loroStore.setFile(currentFile.path, currentFile.content);

			lastSavedContent = currentFile.content;
			currentFile.isDirty = false;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save file';
			throw e;
		}
	}

	function cancelAutoSave() {
		if (autoSaveTimer) {
			clearTimeout(autoSaveTimer);
			autoSaveTimer = null;
		}
	}

	function scheduleAutoSave() {
		if (!autoSaveEnabled || !currentFile || currentFile.isNew) return;

		cancelAutoSave();

		autoSaveTimer = setTimeout(async () => {
			if (currentFile?.isDirty && !currentFile.isNew) {
				try {
					await saveCurrentFile();
					console.log('Auto-saved:', currentFile.path);
				} catch (e) {
					console.error('Auto-save failed:', e);
				}
			}
		}, AUTO_SAVE_DELAY_MS);
	}

	function updateContent(content: string): void {
		if (currentFile) {
			currentFile.content = content;
			currentFile.isDirty = true;

			// Schedule auto-save
			scheduleAutoSave();
		}
	}

	async function deleteItem(path: string, isFolder: boolean): Promise<void> {
		try {
			if (isFolder) {
				await opfs.deleteFolder(path);
				// TODO: Delete children from Loro?
				// Would need to list children and delete each.
			} else {
				await opfs.deleteFile(path);
				// Sync delete to Loro
				loroStore.deleteFile(path);

				// Also clear history for deleted files
				await historyStore.clearHistory(path);
			}

			// Close file if it was open
			if (currentFile?.path === path) {
				currentFile = null;
				lastSavedContent = '';
			}

			await refresh();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to delete';
			throw e;
		}
	}

	async function renameItem(oldPath: string, newName: string): Promise<void> {
		// Validate inputs
		if (!oldPath || !newName || !newName.trim()) {
			console.error('Invalid rename parameters:', { oldPath, newName });
			return;
		}

		console.log('Renaming:', { oldPath, newName });

		try {
			const finalName = newName.trim();
			const newPath = oldPath.split('/').slice(0, -1).concat(finalName).join('/');

			// Get content from Loro BEFORE renaming in OPFS
			const loroContent = loroStore.getFile(oldPath);

			// Rename in OPFS
			await opfs.rename(oldPath, newPath);

			// Sync to Loro: set new path, delete old path
			if (loroContent) {
				loroStore.setFile(newPath, loroContent);
				loroStore.deleteFile(oldPath);
			}

			// Update current file if it was renamed
			if (currentFile && currentFile.path === oldPath) {
				currentFile.path = newPath;
				currentFile.name = finalName.endsWith('.md') ? finalName : `${finalName}.md`;
			}

			await refresh();
		} catch (e) {
			console.error('Rename error:', e);
			error = e instanceof Error ? e.message : 'Failed to rename';
			throw e;
		}
	}

	function newUnsavedFile(): void {
		cancelAutoSave();
		currentFile = {
			id: `new-${Date.now()}`,
			path: '',
			name: 'Untitled.md',
			content: '',
			isDirty: true,
			isNew: true
		};
		// NOT syncing to Loro yet, purely local drafting
		lastSavedContent = '';
	}

	async function saveNewFile(folderPath: string, name: string): Promise<void> {
		if (!currentFile?.isNew) return;

		const path = await createFile(folderPath, name);
		currentFile.path = path;
		currentFile.id = path;
		currentFile.name = name.endsWith('.md') ? name : `${name}.md`;
		// The file is saved now, so it is no longer "new" (unsaved state)
		currentFile.isNew = false;

		// createFile already syncs to Loro!

		await saveCurrentFile();
		localStorage.setItem(LAST_FILE_KEY, path);
		// notify presence
		loroStore.setCurrentFile(path);
	}

	// ... restoreVersion, closeFile, importFile ...

	// Simplification: importFile does createFile + write.
	async function importFile(name: string, content: string): Promise<string> {
		// Ensure .md extension
		const fileName = name.endsWith('.md') ? name : `${name}.md`;

		// Check if file already exists... loop for unique name...
		// ... existing logic ...
		// Re-implementing simplified for Loro:

		let finalName = fileName;
		// Check uniqueness locally
		let counter = 1;
		while (await opfs.exists(finalName)) {
			const baseName = fileName.replace(/\.md$/, '');
			finalName = `${baseName} (${counter}).md`;
			counter++;
		}

		await opfs.createFile(finalName, content);

		// Sync
		loroStore.setFile(finalName, content);

		await refresh();
		await openFile(finalName);

		return finalName;
	}

	function restoreVersion(versionId: string): Promise<void> {
		// ... handled by history store, then updates content ...
		// Need to ensure it triggers saveCurrentFile to sync?
		return Promise.resolve();
	}

	function closeFile(): void {
		cancelAutoSave();
		currentFile = null;
		lastSavedContent = '';
		// Clear presence?
		loroStore.setCurrentFile('');
	}

	function clearError(): void {
		error = null;
	}

	function setAutoSave(enabled: boolean): void {
		autoSaveEnabled = enabled;
		if (!enabled) {
			cancelAutoSave();
		}
	}

	return {
		get files() {
			return files;
		},
		get currentFile() {
			return currentFile;
		},
		get isLoading() {
			return isLoading;
		},
		get error() {
			return error;
		},
		get autoSaveEnabled() {
			return autoSaveEnabled;
		},
		init,
		refresh,
		createFile,
		createFolder,
		openFile,
		saveCurrentFile,
		updateContent,
		deleteItem,
		renameItem, // Rename impl simplified above
		newUnsavedFile,
		saveNewFile,
		restoreVersion,
		closeFile,
		importFile,
		clearError,
		setAutoSave,
		syncAllToLoro: () => syncAllToLoro(files),
		setScope: async (scope: string) => {
			opfs.setScope(scope);
			// content of current file might be invalid in new scope
			currentFile = null;
			lastSavedContent = '';
			await refresh();
		}
	};
}

export const filesStore = createFilesStore();
