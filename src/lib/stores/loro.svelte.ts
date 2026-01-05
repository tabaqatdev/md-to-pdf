import { LoroDoc, LoroText, LoroMap, EphemeralStore, VersionVector } from 'loro-crdt';
import type { Peer, DataConnection } from 'peerjs';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';

export interface PeerState {
	id: string;
	name: string;
	color: string;
	colorClassName: string;
	currentFileId: string | null;
	[key: string]: any; // Index signature for loro-codemirror compatibility
}

export class LoroStore {
	doc: LoroDoc;
	ephemeral: EphemeralStore;
	filesMap: LoroMap;
	me: PeerState;

	// Awareness
	private awarenessMap = new SvelteMap<string, PeerState>();
	awareness = $state<PeerState[]>([]);

	// PeerJS
	peer: Peer | null = null;
	connections = new SvelteMap<string, DataConnection>();
	roomId = $state<string | null>(null);
	isHost = $state(false);

	// Track file paths manually since Loro doesn't expose getTextKeys()
	private filePaths = new SvelteSet<string>();

	// Callback for external stores to react (e.g., filesStore)
	private onRemoteChange?: () => void;

	private applyingRemote = false;
	private lastFrontiers: VersionVector | undefined;

	constructor() {
		this.doc = new LoroDoc();
		this.ephemeral = new EphemeralStore();

		// Initialize 'files' map to store all documents
		this.filesMap = this.doc.getMap('files');

		this.me = {
			id: Math.random().toString(36).substring(2, 9),
			name: 'User-' + Math.floor(Math.random() * 1000),
			color: '#' + Math.floor(Math.random() * 16777215).toString(16),
			colorClassName: 'cursor-blue-500',
			currentFileId: null
		};
		this.setupBehaviors();
	}

	setChangeCallback(cb: () => void) {
		this.onRemoteChange = cb;
	}

	private setupBehaviors() {
		// Broadcast local ephemeral updates to all connected peers
		this.ephemeral.subscribeLocalUpdates((data) => {
			const msg = { type: 'ephemeral', data: Array.from(data) };
			// Update local awareness list for self immediately
			this.updateLocalAwareness();
			this.broadcast(msg);
		});

		// Subscribe to ALL ephemeral updates (local + remote) to update UI list
		this.ephemeral.subscribe(() => {
			this.updateLocalAwareness();
		});

		// Broadcast local doc updates
		this.doc.subscribe((event) => {
			if (this.applyingRemote) {
				// If remote change, notify app to update file list/content if needed
				if (this.onRemoteChange) this.onRemoteChange();
				return;
			}

			try {
				const currentFrontiers = this.doc.oplogVersion();
				const updates = this.doc.export({
					mode: 'update',
					from: this.lastFrontiers
				});
				this.lastFrontiers = currentFrontiers;

				if (updates.length > 0) {
					const msg = { type: 'update', data: Array.from(updates) };
					this.broadcast(msg);
				}
			} catch (e) {
				console.error('Broadcast error', e);
			}
		});
	}

	private updateLocalAwareness() {
		const states = this.ephemeral.getAllStates();
		const peers: PeerState[] = [];

		// Add self
		const selfState = this.ephemeral.get(this.me.id) as unknown;
		if (selfState && typeof selfState === 'object') {
			peers.push({ ...selfState, id: this.me.id } as PeerState);
		} else {
			// If not in store yet, push local me
			peers.push(this.me);
		}

		// Add remote peers
		Object.entries(states).forEach(([id, state]: [string, any]) => {
			if (id !== this.me.id && typeof state === 'object' && state !== null) {
				peers.push({ ...state, id } as PeerState);
			}
		});

		this.awareness = peers;
	}

	// File Operations supported by Loro

	// Create or update a file content
	setFile(path: string, content: string) {
		// Get the text container from the document (creates if doesn't exist)
		const text = this.doc.getText(path);

		// Track this file path
		this.filePaths.add(path);

		// Replace content if different
		const currentContent = text.toString();
		if (currentContent !== content) {
			text.delete(0, text.length);
			text.insert(0, content);
		}
	}

	// Delete a file
	deleteFile(path: string) {
		this.filesMap.delete(path);
		this.filePaths.delete(path);
	}

	// Get file content
	getFile(path: string): string | null {
		try {
			const text = this.doc.getText(path);
			return text.toString();
		} catch {
			return null;
		}
	}

	// List all files in Loro
	listFiles(): string[] {
		// Return tracked file paths
		return Array.from(this.filePaths);
	}

	// Presence
	setCurrentFile(fileId: string) {
		this.me.currentFileId = fileId;
		// Broadcast presence change via Ephemeral
		this.ephemeral.set(this.me.id, this.me as any);
	}

	// Initialization
	init(content: string = '') {
		// No-op for global store
	}

	private onBecameHost?: () => void;

	setHostCallback(cb: () => void) {
		this.onBecameHost = cb;
	}

	async joinRoom(roomId: string | null) {
		if (typeof window === 'undefined') return;

		console.log('[LoroStore] joinRoom called with roomId:', roomId);
		const { Peer } = await import('peerjs');

		// Cleanup
		this.peer?.destroy();
		this.connections.clear();

		// Config for PeerJS with STUN + TURN servers
		// Use multiple STUN/TURN servers for better reliability
		// Don't rely on default PeerJS server which is often unreliable
		const peerConfig = {
			// Use a more reliable PeerJS cloud server or self-hosted
			// For now, using the default but with better error handling
			host: '0.peerjs.com',
			port: 443,
			path: '/',
			secure: true,
			debug: 2, // Level 2 debug for connection issues
			config: {
				iceServers: [
					// Multiple STUN servers for redundancy (Google's public STUN servers)
					{ urls: 'stun:stun.l.google.com:19302' },
					{ urls: 'stun:stun1.l.google.com:19302' },
					{ urls: 'stun:stun2.l.google.com:19302' },
					{ urls: 'stun:stun3.l.google.com:19302' },
					{ urls: 'stun:stun4.l.google.com:19302' },
					// Cloudflare's public STUN server
					{ urls: 'stun:stun.cloudflare.com:3478' }
					// Note: For TURN servers, you typically need credentials
					// Free public TURN servers are unreliable or require signup
					// Options:
					// 1. Use a service like Twilio, Xirsys, or Cloudflare Calls
					// 2. Self-host coturn server
					// 3. For local testing, direct P2P via STUN usually works
					// For now, relying on STUN which works for most cases
				],
				// Optimize ICE gathering
				iceTransportPolicy: 'all', // Try all connection methods
				iceCandidatePoolSize: 10,
				bundlePolicy: 'max-bundle',
				rtcpMuxPolicy: 'require'
			}
		};

		if (!roomId) {
			// No Room ID: We are creating a new room, so we are definitely Host.
			this.isHost = true;
			this.peer = new Peer(peerConfig);
			this.setupPeerEvents(this.peer);
		} else {
			// Room ID provided: Try to claim it to be Host.
			console.log('[LoroStore] Attempting to claim Room ID as Host:', roomId);
			const tryHostPeer = new Peer(roomId, peerConfig);

			tryHostPeer.on('open', (id) => {
				console.log('[LoroStore] Successfully claimed Room ID. I am Host:', id);
				this.isHost = true;
				this.peer = tryHostPeer;
				this.roomId = id;
				this.ephemeral.set(this.me.id, this.me as any);
				this.setupPeerEvents(this.peer);

				// Notify listeners that we became host
				if (this.onBecameHost) this.onBecameHost();
			});

			tryHostPeer.on('error', (err: any) => {
				console.log('[LoroStore] Peer Error during claim attempt:', err.type);
				if (err.type === 'unavailable-id') {
					console.log('[LoroStore] Room ID taken. Joining as Client.');
					tryHostPeer.destroy();

					// Fallback to Client Mode
					this.isHost = false;
					this.peer = new Peer(peerConfig); // Get random ID
					this.setupPeerEvents(this.peer, roomId);
				} else {
					console.error('[LoroStore] Critical Peer Error:', err);
				}
			});
		}
	}

	private setupPeerEvents(peer: Peer, connectToRoomId?: string) {
		peer.on('open', (id) => {
			console.log('[LoroStore] My Peer ID:', id);

			if (this.isHost) {
				this.roomId = id;
				// Already handled presence in joinRoom for claimed host, but good to ensure
				this.ephemeral.set(this.me.id, this.me as any);
			} else if (connectToRoomId) {
				// Client mode: connect to the room
				console.log('[LoroStore] Connecting to target room:', connectToRoomId);
				this.connectToPeer(connectToRoomId);
				this.ephemeral.set(this.me.id, this.me as any);
			}
		});

		peer.on('connection', (conn) => {
			console.log('[LoroStore] Incoming connection from:', conn.peer);
			this.handleConnection(conn);
		});

		peer.on('error', (err: any) => {
			console.error('[LoroStore] PeerJS Error:', err);

			// Provide more specific error handling
			if (err.type === 'network') {
				console.error('[LoroStore] Network error - check internet connection');
			} else if (err.type === 'server-error') {
				console.error('[LoroStore] Server error - PeerJS server may be down. Retrying...');
				// Could implement retry logic here
			} else if (err.type === 'socket-error') {
				console.error('[LoroStore] Socket error - connection to PeerJS server lost');
			} else if (err.type === 'socket-closed') {
				console.error('[LoroStore] Socket closed - attempting to reconnect...');
			} else if (err.type === 'unavailable-id') {
				// This is expected when joining an existing room, handled elsewhere
				console.log('[LoroStore] Room ID already taken (expected for client join)');
			} else {
				console.error('[LoroStore] Unknown peer error type:', err.type);
			}
		});
	}

	private connectToPeer(hostId: string) {
		if (!this.peer) return;
		const conn = this.peer.connect(hostId);
		this.handleConnection(conn);
	}

	private handleConnection(conn: DataConnection) {
		console.log('[LoroStore] Setting up connection handlers for peer:', conn.peer);
		console.log('[LoroStore] Connection state:', conn.peerConnection?.connectionState);
		console.log('[LoroStore] ICE connection state:', conn.peerConnection?.iceConnectionState);

		conn.on('open', () => {
			console.log('[LoroStore] ✓ Connection ESTABLISHED with:', conn.peer);
			this.connections.set(conn.peer, conn);

			// Initial Sync: Send Snapshot
			const snapshot = this.doc.export({ mode: 'snapshot' });
			console.log('[LoroStore] Sending snapshot to client, size:', snapshot.length, 'bytes');
			conn.send({ type: 'sync', data: Array.from(snapshot) });

			// Initial Eph Sync
			const ephState = this.ephemeral.encodeAll();
			if (ephState.length > 0) {
				console.log('[LoroStore] Sending ephemeral state, size:', ephState.length, 'bytes');
				conn.send({ type: 'ephemeral', data: Array.from(ephState) });
			}
		});

		conn.on('data', (data: any) => {
			console.log('[LoroStore] Received data from:', conn.peer, 'type:', data.type);
			this.handleMessage(data, conn.peer);
		});

		conn.on('error', (err) => {
			console.error('[LoroStore] Connection error with', conn.peer, ':', err);
		});

		conn.on('close', () => {
			console.log('[LoroStore] Connection closed:', conn.peer);
			this.connections.delete(conn.peer);
			this.updateLocalAwareness();
		});

		// Monitor ICE connection state changes
		if (conn.peerConnection) {
			conn.peerConnection.addEventListener('iceconnectionstatechange', () => {
				console.log(
					'[LoroStore] ICE connection state changed to:',
					conn.peerConnection?.iceConnectionState
				);
			});

			conn.peerConnection.addEventListener('connectionstatechange', () => {
				console.log(
					'[LoroStore] Connection state changed to:',
					conn.peerConnection?.connectionState
				);
			});
		}
	}

	private handleMessage(msg: any, senderId: string) {
		try {
			if (msg.type === 'sync' || msg.type === 'update') {
				this.applyingRemote = true;
				this.doc.import(new Uint8Array(msg.data));
				this.lastFrontiers = this.doc.oplogVersion();
				this.applyingRemote = false;

				if (this.isHost) {
					this.broadcast(msg, senderId);
				}

				// Notify listeners
				if (this.onRemoteChange) this.onRemoteChange();
			} else if (msg.type === 'ephemeral') {
				this.ephemeral.apply(new Uint8Array(msg.data));

				if (this.isHost) {
					this.broadcast(msg, senderId);
				}
			}
		} catch (e) {
			console.error('Data error', e);
		}
	}

	private broadcast(msg: any, excludeId?: string) {
		this.connections.forEach((conn, peerId) => {
			if (peerId !== excludeId && conn.open) {
				conn.send(msg);
			}
		});
	}

	getDoc() {
		return this.doc;
	}

	// Helper to get LoroText for a specific file for Editor
	getDocText(path: string): LoroText {
		// Use doc.getText() which returns an attached container
		return this.doc.getText(path);
	}
}

export const loroStore = new LoroStore();
