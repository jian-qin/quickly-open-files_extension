import { workspace, window, Uri, Range } from 'vscode';
import WebSocket, { WebSocketServer } from 'ws';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { bringVscodeToFront } from './tools';

// 获取设置的端口号
const port = workspace.getConfiguration('quickly-open-files').get<number>('port')!;

// 项目根目录地址列表
const rootUrlList = workspace.workspaceFolders ? workspace.workspaceFolders.map(item => formatRootUrl(item.uri.path)) : [];

// 格式化url
function formatRootUrl(url: string) {
	return url.replaceAll('\\', '/').replace(/^([^/])/, '/$1').replace(/^\/\w+:/, (match) => match.toLowerCase());
}

// 创建 WebSocket 服务器
const wsServerPromise = new Promise<WebSocketServer>((resolve, reject) => {
	createWsServer();
	function createWsServer() {
		const _wsServer = new WebSocketServer({ port });
		_wsServer.on('listening', () => resolve(_wsServer));
		_wsServer.on('error', (err: { code: string }) => {
			_wsServer.close();
			if (err.code === 'EADDRINUSE') {
				setTimeout(createWsServer, 4000);
			} else {
				reject(err);
			}
		});
	}
});

// 监听 WebSocket 服务器的连接事件，当有新的 WebSocket 连接时，将消息广播给所有的 WebSocket 连接
wsServerPromise.then(wsServer => {
	wsServer.on('connection', (ws) => {
		ws.on('message', (res) => {
			wsServer.clients.forEach(_ws => {
				if (_ws === ws) {
					return;
				}
				if (_ws.readyState !== WebSocket.OPEN) {
					return;
				}
				_ws.send(res.toString());
			});
		});
	});
});

interface Message {
	to: 'server' | 'client';
	type: 'openFile' | `relay-broadcast:${string}`;
	data: any;
}

// 监听 WebSocket 客户端的消息事件，当收到消息时，根据消息类型执行不同的操作
const clientWs = new ReconnectingWebSocket(`ws://localhost:${port}/`, [], { WebSocket });

// 监听打开文件的消息，当收到打开文件的消息时，打开文件
clientWs.addEventListener('message', (res) => {
	const { to, type, data }: Message = JSON.parse(res.data);
	if (to !== 'server') {
		return;
	}
	if (type !== 'openFile') {
		return;
	}
	const url = formatRootUrl(data);
	if (!rootUrlList.some(rootUrl => url.startsWith(rootUrl))) {
		return;
	}
	bringVscodeToFront();
	const reg = /:(\d+):(\d+)$/;
	const fileUrl = url.replace(reg, '');
	const position = url.match(reg) || { 1: '1', 2: '1' };
	const line = Number(position[1]) - 1;
	const column = Number(position[2]) - 1;
	window.showTextDocument(Uri.file(fileUrl), {
		selection: new Range(line, column, line, column),
	});
});
