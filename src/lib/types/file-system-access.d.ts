/**
 * Type declarations for File System Access API
 * These extend the standard DOM types to include OPFS-specific async iterators
 */

interface FileSystemDirectoryHandle {
	entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
	keys(): AsyncIterableIterator<string>;
	values(): AsyncIterableIterator<FileSystemHandle>;
	[Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>;
}
