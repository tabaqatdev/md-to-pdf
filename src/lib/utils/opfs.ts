/**
 * OPFS (Origin Private File System) wrapper for file management
 * Provides folder structure and file operations for markdown documents
 */

export interface FileNode {
	id: string;
	name: string;
	type: 'file' | 'folder';
	path: string;
	parentPath: string;
	children?: FileNode[];
	content?: string;
	createdAt: number;
	updatedAt: number;
}

export interface FileMetadata {
	id: string;
	name: string;
	path: string;
	createdAt: number;
	updatedAt: number;
}

const ROOT_DIR = 'md-to-pdf';
const METADATA_FILE = '.metadata.json';

class OPFSManager {
	private root: FileSystemDirectoryHandle | null = null;
	private initialized = false;
	private scope = '';

	async init(): Promise<void> {
		if (this.initialized) return;

		try {
			const opfsRoot = await navigator.storage.getDirectory();
			this.root = await opfsRoot.getDirectoryHandle(ROOT_DIR, { create: true });
			this.initialized = true;
		} catch (error) {
			console.error('Failed to initialize OPFS:', error);
			throw new Error('OPFS not supported or access denied');
		}
	}

	setScope(path: string) {
		this.scope = path;
		console.log(`OPFS scope set to: '${this.scope}'`);
	}

	private async ensureInit(): Promise<FileSystemDirectoryHandle> {
		if (!this.initialized || !this.root) {
			await this.init();
		}
		return this.root!;
	}

	// Helper to resolve logical path to physical path including scope
	private resolvePath(path: string | undefined): string {
		const cleanPath = path || '';
		if (this.scope) {
			return cleanPath ? `${this.scope}/${cleanPath}` : this.scope;
		}
		return cleanPath;
	}

	private async getDirectoryHandle(
		path: string,
		create = false
	): Promise<FileSystemDirectoryHandle> {
		// Resolve scoped path
		const fullPath = this.resolvePath(path);
		return this.getRawDirectoryHandle(fullPath, create);
	}

	private async getFileHandle(path: string, create = false): Promise<FileSystemFileHandle> {
		// Resolve scope first
		const fullPath = this.resolvePath(path);

		const parts = fullPath.split('/').filter(Boolean);
		const fileName = parts.pop();
		if (!fileName) throw new Error('Invalid file path');

		const dirPath = parts.join('/');
		// Now call getRawDirectoryHandle because dirPath is already a physical path relative to root
		const dir = await this.getRawDirectoryHandle(dirPath, create);
		return dir.getFileHandle(fileName, { create });
	}

	private async getRawDirectoryHandle(
		path: string,
		create = false
	): Promise<FileSystemDirectoryHandle> {
		const root = await this.ensureInit();
		if (!path || path === '/') return root;

		const parts = path.split('/').filter(Boolean);
		let current = root;

		for (const part of parts) {
			current = await current.getDirectoryHandle(part, { create });
		}

		return current;
	}

	async createFolder(path: string): Promise<void> {
		console.log('OPFS createFolder:', path);
		await this.getDirectoryHandle(path, true);
		console.log('OPFS createFolder completed:', path);
	}

	async createFile(path: string, content = ''): Promise<void> {
		const handle = await this.getFileHandle(path, true);
		const writable = await handle.createWritable();
		await writable.write(content);
		await writable.close();
	}

	async readFile(path: string): Promise<string> {
		try {
			const handle = await this.getFileHandle(path);
			const file = await handle.getFile();
			return await file.text();
		} catch {
			throw new Error(`File not found: ${path}`);
		}
	}

	async writeFile(path: string, content: string): Promise<void> {
		const handle = await this.getFileHandle(path, true);
		const writable = await handle.createWritable();
		await writable.write(content);
		await writable.close();
	}

	async deleteFile(path: string): Promise<void> {
		const parts = path.split('/').filter(Boolean);
		const fileName = parts.pop();
		if (!fileName) throw new Error('Invalid file path');

		const dirPath = parts.join('/');
		const dir = await this.getDirectoryHandle(dirPath);
		await dir.removeEntry(fileName);
	}

	async deleteFolder(path: string): Promise<void> {
		const parts = path.split('/').filter(Boolean);
		const folderName = parts.pop();
		if (!folderName) throw new Error('Invalid folder path');

		const parentPath = parts.join('/');
		const parent = await this.getDirectoryHandle(parentPath);
		await parent.removeEntry(folderName, { recursive: true });
	}

	async rename(oldPath: string, newPath: string): Promise<void> {
		console.log('OPFS rename:', { oldPath, newPath });

		// OPFS doesn't have a native rename, so we copy and delete
		// Determine if it's a file by checking if we can get a file handle
		let isFile = false;
		try {
			await this.getFileHandle(oldPath);
			isFile = true;
		} catch {
			// Could be a folder or doesn't exist
			isFile = false;
		}

		console.log('OPFS rename - isFile:', isFile);

		if (isFile) {
			// Read content first
			const content = await this.readFile(oldPath);
			console.log('OPFS rename - read content length:', content.length);

			// Create new file with content
			await this.createFile(newPath, content);
			console.log('OPFS rename - created new file:', newPath);

			// Delete old file
			await this.deleteFile(oldPath);
			console.log('OPFS rename - deleted old file:', oldPath);
		} else {
			// For folders, we need to recursively copy
			// Get all entries including hidden ones
			const dir = await this.getDirectoryHandle(oldPath);
			await this.createFolder(newPath);

			// Use the iterator pattern for FileSystemDirectoryHandle
			for await (const entry of (dir as any).values()) {
				const name = entry.name;
				const oldEntryPath = `${oldPath}/${name}`;
				const newEntryPath = `${newPath}/${name}`;

				if (entry.kind === 'directory') {
					await this.rename(oldEntryPath, newEntryPath);
				} else {
					const content = await this.readFile(oldEntryPath);
					await this.createFile(newEntryPath, content);
				}
			}

			await this.deleteFolder(oldPath);
		}

		console.log('OPFS rename completed');
	}

	async listDirectory(path = ''): Promise<FileNode[]> {
		let dir: FileSystemDirectoryHandle;
		try {
			dir = await this.getDirectoryHandle(path);
		} catch (e) {
			console.warn(`OPFS listDirectory failed for path '${path}' (likely doesn't exist yet):`, e);
			return [];
		}

		const entries: FileNode[] = [];
		const now = Date.now();

		console.log(`OPFS listDirectory: ${path || 'root'}`);
		for await (const [name, handle] of dir.entries()) {
			console.log(`  Entry: ${name}, kind: ${handle.kind}`);
			// Skip metadata and hidden folders (like .history)
			if (name === METADATA_FILE || name.startsWith('.')) {
				console.log(`  Skipping: ${name}`);
				continue;
			}

			const entryPath = path ? `${path}/${name}` : name;
			const entry: FileNode = {
				id: entryPath,
				name,
				type: handle.kind === 'directory' ? 'folder' : 'file',
				path: entryPath,
				parentPath: path,
				createdAt: now,
				updatedAt: now
			};

			if (handle.kind === 'directory') {
				entry.children = await this.listDirectory(entryPath);
			}

			entries.push(entry);
		}

		// Sort folders first, then files, alphabetically
		const sorted = entries.sort((a, b) => {
			if (a.type !== b.type) {
				return a.type === 'folder' ? -1 : 1;
			}
			return a.name.localeCompare(b.name);
		});

		console.log(
			`OPFS listDirectory result:`,
			sorted.map((e) => `${e.name} (${e.type})`)
		);
		return sorted;
	}

	async exists(path: string): Promise<boolean> {
		try {
			const parts = path.split('/').filter(Boolean);
			const name = parts.pop();
			if (!name) return false;

			const dirPath = parts.join('/');
			const dir = await this.getDirectoryHandle(dirPath);

			for await (const [entryName] of dir.entries()) {
				if (entryName === name) return true;
			}
			return false;
		} catch {
			return false;
		}
	}

	async getStorageEstimate(): Promise<{ usage: number; quota: number }> {
		const estimate = await navigator.storage.estimate();
		return {
			usage: estimate.usage || 0,
			quota: estimate.quota || 0
		};
	}
}

export const opfs = new OPFSManager();
