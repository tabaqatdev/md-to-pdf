/**
 * Version History Store
 * Manages file version history using OPFS
 */

import { opfs } from '$lib/utils/opfs';

export interface FileVersion {
	id: string;
	filePath: string;
	content: string;
	timestamp: number;
	size: number;
}

const HISTORY_DIR = '.history';
const MAX_VERSIONS_PER_FILE = 50;
const VERSION_INTERVAL_MS = 60000; // Minimum 1 minute between versions

function createHistoryStore() {
	let versions = $state<FileVersion[]>([]);
	let isLoading = $state(false);
	let currentFilePath = $state<string | null>(null);
	let lastVersionTime = $state<number>(0);

	async function init() {
		try {
			await opfs.createFolder(HISTORY_DIR);
		} catch {
			// Folder might already exist
		}
	}

	/**
	 * Save a version of the file
	 */
	async function saveVersion(filePath: string, content: string): Promise<void> {
		if (!filePath || !content) return;

		// Check if enough time has passed since last version
		const now = Date.now();
		if (now - lastVersionTime < VERSION_INTERVAL_MS) {
			return;
		}

		try {
			const timestamp = now;
			const versionId = `${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
			const safeFileName = filePath.replace(/\//g, '_').replace(/\./g, '_');
			const versionPath = `${HISTORY_DIR}/${safeFileName}/${versionId}.md`;

			// Create file-specific history folder
			await opfs.createFolder(`${HISTORY_DIR}/${safeFileName}`);

			// Save version
			await opfs.createFile(versionPath, content);

			lastVersionTime = now;

			// Clean up old versions if needed
			await cleanupOldVersions(filePath);
		} catch (e) {
			console.error('Failed to save version:', e);
		}
	}

	/**
	 * Load all versions for a file
	 */
	async function loadVersions(filePath: string): Promise<void> {
		if (!filePath) {
			versions = [];
			return;
		}

		isLoading = true;
		currentFilePath = filePath;

		try {
			const safeFileName = filePath.replace(/\//g, '_').replace(/\./g, '_');
			const historyPath = `${HISTORY_DIR}/${safeFileName}`;

			const entries = await opfs.listDirectory(historyPath);
			const loadedVersions: FileVersion[] = [];

			for (const entry of entries) {
				if (entry.type === 'file' && entry.name.endsWith('.md')) {
					try {
						const content = await opfs.readFile(entry.path);
						const timestampMatch = entry.name.match(/^(\d+)-/);
						const timestamp = timestampMatch ? parseInt(timestampMatch[1]) : entry.createdAt;

						loadedVersions.push({
							id: entry.id,
							filePath: filePath,
							content,
							timestamp,
							size: content.length
						});
					} catch {
						// Skip unreadable versions
					}
				}
			}

			// Sort by timestamp descending (newest first)
			versions = loadedVersions.sort((a, b) => b.timestamp - a.timestamp);
		} catch {
			// No history folder for this file yet
			versions = [];
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Get content of a specific version
	 */
	async function getVersionContent(versionId: string): Promise<string | null> {
		const version = versions.find((v) => v.id === versionId);
		return version?.content || null;
	}

	/**
	 * Delete a specific version
	 */
	async function deleteVersion(versionId: string): Promise<void> {
		try {
			await opfs.deleteFile(versionId);
			versions = versions.filter((v) => v.id !== versionId);
		} catch (e) {
			console.error('Failed to delete version:', e);
		}
	}

	/**
	 * Clean up old versions beyond MAX_VERSIONS_PER_FILE
	 */
	async function cleanupOldVersions(filePath: string): Promise<void> {
		const safeFileName = filePath.replace(/\//g, '_').replace(/\./g, '_');
		const historyPath = `${HISTORY_DIR}/${safeFileName}`;

		try {
			const entries = await opfs.listDirectory(historyPath);
			const fileEntries = entries.filter((e) => e.type === 'file');

			if (fileEntries.length > MAX_VERSIONS_PER_FILE) {
				// Sort by name (which includes timestamp) descending
				const sorted = fileEntries.sort((a, b) => b.name.localeCompare(a.name));
				const toDelete = sorted.slice(MAX_VERSIONS_PER_FILE);

				for (const entry of toDelete) {
					await opfs.deleteFile(entry.path);
				}
			}
		} catch {
			// Ignore cleanup errors
		}
	}

	/**
	 * Clear all history for a file
	 */
	async function clearHistory(filePath: string): Promise<void> {
		const safeFileName = filePath.replace(/\//g, '_').replace(/\./g, '_');
		const historyPath = `${HISTORY_DIR}/${safeFileName}`;

		try {
			await opfs.deleteFolder(historyPath);
			if (currentFilePath === filePath) {
				versions = [];
			}
		} catch {
			// Ignore if folder doesn't exist
		}
	}

	return {
		get versions() {
			return versions;
		},
		get isLoading() {
			return isLoading;
		},
		get currentFilePath() {
			return currentFilePath;
		},
		init,
		saveVersion,
		loadVersions,
		getVersionContent,
		deleteVersion,
		clearHistory
	};
}

export const historyStore = createHistoryStore();
