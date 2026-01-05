import { opfs, type FileNode } from '$lib/utils/opfs';
import { historyStore } from './history.svelte';

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
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to initialize file system';
			console.error('Files store init error:', e);
		} finally {
			isLoading = false;
		}
	}

	function handleBeforeUnload(event: BeforeUnloadEvent) {
		if (currentFile?.isDirty && !currentFile.isNew) {
			// Try to save synchronously (best effort)
			// Note: async operations may not complete before page closes
			event.preventDefault();
			event.returnValue = '';

			// Trigger save
			saveCurrentFile();
		}
	}

	async function refresh() {
		try {
			const newFiles = await opfs.listDirectory();
			// Force reactivity by creating a new array reference
			files = [...newFiles];
			console.log(
				'Refresh complete, files:',
				files.map((f) => f.name)
			);
		} catch (e) {
			console.error('Failed to refresh files:', e);
			files = [];
		}
	}

	async function createFile(path: string, name: string): Promise<string> {
		const fullPath = path ? `${path}/${name}` : name;
		const filePath = fullPath.endsWith('.md') ? fullPath : `${fullPath}.md`;

		await opfs.createFile(filePath, '');
		await refresh();

		return filePath;
	}

	async function createFolder(path: string, name: string): Promise<void> {
		const fullPath = path ? `${path}/${name}` : name;
		await opfs.createFolder(fullPath);
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

		try {
			// Save version to history before overwriting (if content changed significantly)
			if (lastSavedContent && currentFile.content !== lastSavedContent) {
				await historyStore.saveVersion(currentFile.path, lastSavedContent);
			}

			await opfs.writeFile(currentFile.path, currentFile.content);
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
			} else {
				await opfs.deleteFile(path);
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

		const trimmedName = newName.trim();
		const parts = oldPath.split('/');
		const oldName = parts.pop() || '';

		// Check if old item was a file (had .md extension)
		const wasFile = oldName.endsWith('.md');

		// Ensure .md extension is preserved for files
		let finalName = trimmedName;
		if (wasFile && !trimmedName.endsWith('.md')) {
			finalName = `${trimmedName}.md`;
		}

		// If name hasn't changed, skip
		if (finalName === oldName) {
			console.log('Name unchanged, skipping rename');
			return;
		}

		const newPath = parts.length > 0 ? `${parts.join('/')}/${finalName}` : finalName;

		console.log('Renaming:', { oldPath, newPath, oldName, finalName });

		try {
			await opfs.rename(oldPath, newPath);

			// Update current file if it was renamed
			if (currentFile?.path === oldPath) {
				currentFile = {
					...currentFile,
					path: newPath,
					id: newPath,
					name: finalName
				};
				// Update last file reference
				localStorage.setItem(LAST_FILE_KEY, newPath);
			}

			await refresh();
			console.log(
				'Rename completed, files:',
				files.map((f) => f.path)
			);
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
		lastSavedContent = '';
	}

	async function saveNewFile(folderPath: string, name: string): Promise<void> {
		if (!currentFile?.isNew) return;

		const path = await createFile(folderPath, name);
		currentFile.path = path;
		currentFile.id = path;
		currentFile.name = name.endsWith('.md') ? name : `${name}.md`;
		currentFile.isNew = false;

		await saveCurrentFile();
		localStorage.setItem(LAST_FILE_KEY, path);
	}

	async function restoreVersion(versionId: string): Promise<void> {
		const content = await historyStore.getVersionContent(versionId);
		if (content && currentFile) {
			// Save current content as a version before restoring
			if (currentFile.content && currentFile.content !== lastSavedContent) {
				await historyStore.saveVersion(currentFile.path, currentFile.content);
			}

			currentFile.content = content;
			currentFile.isDirty = true;

			// Reload history to show the restored point
			await historyStore.loadVersions(currentFile.path);
		}
	}

	function closeFile(): void {
		cancelAutoSave();
		currentFile = null;
		lastSavedContent = '';
	}

	async function importFile(name: string, content: string): Promise<string> {
		// Ensure .md extension
		const fileName = name.endsWith('.md') ? name : `${name}.md`;

		// Check if file already exists and create unique name if needed
		let finalName = fileName;
		let counter = 1;
		while (await opfs.exists(finalName)) {
			const baseName = fileName.replace(/\.md$/, '');
			finalName = `${baseName} (${counter}).md`;
			counter++;
		}

		await opfs.createFile(finalName, content);
		await refresh();
		await openFile(finalName);

		return finalName;
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
		renameItem,
		newUnsavedFile,
		saveNewFile,
		restoreVersion,
		closeFile,
		importFile,
		clearError,
		setAutoSave
	};
}

export const filesStore = createFilesStore();
