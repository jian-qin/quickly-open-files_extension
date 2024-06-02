import { workspace, window, Uri } from 'vscode';
import { createServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';

/**
 * 消息格式
 * @typedef {{
 *      id: string | number,
 *      event: string,
 *      targetEvent?: string,
 *      description: string,
 *      data: any,
 *  }} SendParam
 */

/**
 * 事件列表：服务端->客户端
 * callback: 消息回调
 * openPage: 打开页面
 */

/**
 * 事件列表：客户端->服务端
 * openFile: vscode打开文件
 * relay-broadcast: 中转广播给其他客户端
 */

// 服务端地址
const BaseUrl = 'http://localhost:4444/';

// 项目根目录地址列表
const rootUrlList = workspace.workspaceFolders?.map(item => item.uri.path) || [];

// 项目根目录地址列表的pathname列表
const pathnameList = rootUrlList.map(url => {
	// 协议部分统一大写
	url = url.replace(/^(.+):/, (_, p1) => p1.toUpperCase());
	// 去掉所有的 \ / : 空格
	url = url.replace(/\\|\/|:|\s/g, '');
	// 使用URL对象转换特殊字符
	return new URL(url, BaseUrl).pathname;
});

// 项目根目录地址列表的pathname列表对应的WebSocketServer实例
const wssCtxs = new Map(
	pathnameList.map(pathname => [pathname, new WebSocketServer({ noServer: true })])
);

// 创建http服务
const server = createServer();
server.on('upgrade', (request, socket, head) => {
	if (!request.url) {
		return;
	}
	const { pathname } = new URL(request.url, BaseUrl);
	const wss = wssCtxs.get(pathname);
	if (wss) {
    wss.handleUpgrade(request, socket, head, function(ws) {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});
server.listen(new URL(BaseUrl).port);


wssCtxs.forEach((wss: WebSocketServer) => {
	wss.on('connection', (ws: WebSocket) => {
		addListening_openFile(ws);
		addListening_relayBroadcast(ws, wss);
	});
});

// 添加事件监听：openFile
function addListening_openFile(ws: WebSocket) {
	ws.on('message', res => {
		const { id, event, data } = JSON.parse(res.toString());
		if (event !== 'openFile') {
			return;
		}
		window.showTextDocument(Uri.file(data)).then(
			() => ws.send(JSON.stringify({
				id,
				event: 'callback',
				description: '打开文件成功',
				data: true,
			})),
			() => ws.send(JSON.stringify({
				id,
				event: 'callback',
				description: '打开文件失败',
				data: false,
			}))
		);
	});
}

// 添加事件监听：relay-broadcast
function addListening_relayBroadcast(ws: WebSocket, wss: WebSocketServer) {
	ws.on('message', e => {
		const { event, targetEvent, data } = JSON.parse(e.toString());
		if (event !== 'relay-broadcast') {
			return;
		}
		wss.clients.forEach(_ws => {
			_ws !== ws && _ws.send(JSON.stringify({
				event: targetEvent,
				description: '中转广播给其他客户端',
				data,
			}));
		});
	});
}
