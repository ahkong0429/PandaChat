'use strict';
// 常量
// const http = require('http');
// const request = require('sync-request');
const _ = require('lodash');
const fs = require('fs');
// const NodeUuid = require('node-uuid');
// const crypto = require('crypto');
const redis = require('redis');
const shortid = require('shortid');
const multer = require('multer');
const uploadPath = 'uploads/images/';
// const gm = require('gm').subClass({ imageMagick: true });
const ADMINPASSWORD = "test";

// 变量
var RedClient = redis.createClient(6379, '127.0.0.1');
var ROOM, USERS, MSGS
// var ROOM = 'ChatRoom';
// var USERS = `${ROOM}UserList`;
// var MSGS = `${ROOM}MsgList`;
// var Player = require('./Player');
// console.log(Player);

// 函数
// function cryptPwd(password) {
// 	var md5 = crypto.createHash('md5');
// 	return md5.update(password).digest('hex');
// }


exports.mainInit = function () {
	return new Main();
};

function Main() { }

Main.prototype = {
	// 初始化
	init: function (port, app, roomname = 'ChatRoom') {
		this.io = require('socket.io')(port);

		// 通过 filename 属性定制
		var storage = multer.diskStorage({
			destination: (req, file, cb) => {
				cb(null, `src/${uploadPath}`);    // 保存的路径，备注：需要自己创建
			},
			filename: (req, file, cb) => {
				// 将保存文件名设置为 字段名 + 时间戳，比如 logo-1478521468943
				// cb(null, file.fieldname + '-' + Date.now());
				var arr = file.originalname.split('.');
				var ext = `.${arr[arr.length - 1]}`;
				var newfilename = `${req.headers.token}-${Date.now()}${ext}`;
				// req.file = newfilename;
				cb(null, newfilename);
			}
		});
		// 通过 storage 选项来对 上传行为 进行定制化
		var upload = multer({ storage: storage, limits: { fileSize: 1024 * 1024 * 20 } })
		// api
		app.post('/uploadImg', upload.single('file'), (req, res) => {
			// console.log(req.file);
			if (req.file) {
				res.send({ ret_code: '0', filename: uploadPath + req.file.filename });
				// // 格式转换
				// let pngname = req.file.filename + '.png';
				// gm('src/' + uploadPath + req.file.filename).noProfile().write('src/' + uploadPath + pngname, function (err) {
				// 	// console.log(err);
				// 	if (!err) {
				// 		res.send({ ret_code: '0', filename: uploadPath + pngname });
				// 	}
				// });
			}
		})

		// 更新房间号
		ROOM = roomname;
		USERS = `${ROOM}UserList`;
		MSGS = `${ROOM}MsgList`;
		// 清空在线人数缓存
		this.RedDel(USERS);
		// 开启连接
		this.io.on('connection', (socket) => {
			socket.setMaxListeners(0);
			// 测试连接状态
			// socket.emit('conn', { code: '200' });
			// 掉线
			socket.on('disconnect', () => {
				var token = socket.token;
				if (token && socket.prooms) {
					_.forEach(socket.prooms, (room) => {
						socket.leave(room);
						this.RedhDel(`${room}userlist`, token, () => {
							this.io.sockets.in(room).emit('LeaveEvent', JSON.stringify(socket.user));
							this.updateOnlineNum(room);
						});
					})
				}
			})
			// 加入房间
			socket.on('JoinRoom', (room, json, callback) => {
				var obj = JSON.parse(json)
				if (!obj.token) {
					// 加上token
					obj.token = shortid.generate();
				}
				if (obj.nickname) {
					socket.token = obj.token;
					socket.user = obj;
					// console.log(socket.prooms);
					socket.prooms = socket.prooms || [];
					if (socket.prooms.indexOf(room) < 0) {
						socket.prooms.push(room);
					}
					socket.join(room);
					obj.prooms = socket.prooms;
					this.RedhSet(`${room}userlist`, obj.token, JSON.stringify(obj), () => {
						// var player = Player.init(obj);
						// 读取缓存消息队列，读取最近20条消息展示给用户
						this.RedGetMsgList(room, (msgs) => {
							if (callback) {
								callback(msgs, obj.token);
								this.updateOnlineNum(room);
								// 通知
								socket.in(room).broadcast.emit('JoinEvent', JSON.stringify(obj));
							}
						})
					});
				}
			})
			socket.on('LeaveRoom', (room, json, callback) => {
				var obj = JSON.parse(json)
				if (obj.token) {
					socket.leave(room);
					this.RedhDel(`${room}userlist`, obj.token, () => {
						if (callback) {
							callback();
							// 通知
							socket.in(room).broadcast.emit('LeaveEvent', JSON.stringify(obj));
							this.updateOnlineNum(room);
						}
					});
				}
			})
			// 收到消息
			socket.on('SendMsg', (room, json, callback) => {
				// console.log(room, json);
				if (socket.LastQuestTime) {
					var diff = new Date().getTime() - socket.LastQuestTime
					// console.log(diff)
					// 1秒间隔防止ddos
					if (diff < 1000) {
						return;
					}
				}

				var obj = JSON.parse(json)
				if (obj.user.token) {
					// 是否禁言
					this.RedhGet('superstoplist', obj.user.token, (result) => {
						if (result) {
							result = JSON.parse(result)
							if (result && result.stop) {
								if (callback) callback(0);
								return;
							}
						}

						obj.time = new Date().getTime();
						json = JSON.stringify(obj);
						// 广播给客户端
						this.io.sockets.in(room).emit('SendMsgEvent', json, room);
						// 缓存消息队列
						RedClient.lpush(`${room}msglist`, json)
						// 记录时间戳
						socket.LastQuestTime = new Date().getTime();
						if (callback) callback(1);
					})
				}
			})

			// 游客注册
			socket.on('GetGuestAccount', (callback) => {
				var obj = {};
				obj.token = shortid.generate();
				obj.nickname = "游客" + new Date().getTime().toString().substr(-8);
				if (callback) {
					callback(obj);
				}
			})

			// 获取官方聊天室列表
			socket.on('GetPandaRoom', (user) => {
				if (!(user && user.token)) return;
				// if ( !user.token) return;
				var arr = [];
				this.RedhGet('UserRoomList', user.token, (json) => {
					var _fixarr = [
						{ name: 'lvvPandaChat1', title: '官方聊天室1' },
						{ name: 'lvvPandaChat2', title: '官方聊天室2' },
						{ name: 'lvvPandaChat3', title: '官方聊天室3' },
						{ name: 'lvvPandaChat4', title: '官方聊天室4' },
						{ name: 'lvvPandaChat5', title: '官方聊天室5' },
						{ name: 'lvvPandaChat6', title: '官方聊天室6' },
						{ name: 'lvvPandaChat7', title: '官方聊天室7' },
						{ name: 'lvvPandaChat8', title: '官方聊天室8' },
						{ name: 'lvvPandaChat9', title: '官方聊天室9' }];
					if (json) {
						var res = JSON.parse(json)
						if (res && res.length > 0) {
							_fixarr = res;
						}
					}
					_.forEach(_fixarr, (room, index) => {
						this.RedGetMsgList(room.name, (msgs) => {
							var obj = {
								roomname: room.name,
								name: room.title.substr(0, 1),
								fullname: room.title,
							};
							if (msgs.length > 0) {
								obj.lastmsg = JSON.parse(msgs[0])
							}
							arr.push(obj);
							if (index == (_fixarr.length - 1)) {
								socket.emit('PrependChat', arr);
							}
						})
					})
				})
				// var _fixarr = ['PandaChat1', 'PandaChat2', 'PandaChat3', 'PandaChat4', 'PandaChat5', 'PandaChat6', 'PandaChat7', 'PandaChat8', 'PandaChat9'];
			})

			// 连接房间
			socket.on('ConnectRoom', (room, json, callback) => {
				var obj = JSON.parse(json)
				if (!obj.token) {
					// 加上token
					// obj.token = shortid.generate();
					return;
				}
				if (obj.nickname) {
					socket.token = obj.token;
					socket.user = obj;
					// console.log(socket.prooms);
					socket.prooms = socket.prooms || [];
					if (socket.prooms.indexOf(room) < 0) {
						socket.prooms.push(room);
					}
					socket.join(room);
					obj.prooms = socket.prooms;
					this.RedhSet(`${room}userlist`, obj.token, JSON.stringify(obj), () => {
						this.updateOnlineNum(room);
					});
					if (callback) {
						callback()
					}
				}
			})

			// 更新用户redis存储的房间列表，排序
			socket.on('UpdateUserRoomList', (user, list) => {
				if (user.token) {
					this.RedhSet('UserRoomList', user.token, JSON.stringify(list))
				}
			})

			// 创建用户房间
			socket.on('CreateRoom', (user, roomtitle, callback) => {
				if (user.token) {
					roomtitle = roomtitle.replace(/ /g, '')
					if (roomtitle == '') {
						if (callback) return callback()
					}
					var name = 'URoom' + shortid.generate();
					var room = {
						name: name,
						roomtitle: roomtitle,
						fullname: roomtitle,
						roomname: name,
						byUser: user,
						createTime: new Date().getTime()
					}
					// 保存房间的创建记录
					this.RedhSet('roomlist', room.name, JSON.stringify(room))
					if (callback) {
						callback(room);
					}
				}
			})

			// 退出房间
			socket.on('QuitRoom', (roomname, user, callback) => {
				if (user && user.token) {
					this.RedhGet('UserRoomList', user.token, (json) => {
						if (json) {
							var list = JSON.parse(json)
							if (list && list.length > 0) {
								// 删除个人记录
								_.remove(list, (o) => {
									return o.name == roomname
								})
								// 断开连接
								socket.leave(roomname)
								// 保存
								this.RedhSet('UserRoomList', user.token, JSON.stringify(list), () => {
									if (callback) {
										callback();
									}
								})
							}
						}
					})
					this.updateOnlineNum(roomname);
				}
			})

			socket.on('SetMyID', (user, newid, callback) => {
				if (user && user.token && newid) {
					this.RedhGet('cidlist', newid, (res) => {
						if (res && res.length > 0) {
							return callback(300)
						}
						user.updateTime = new Date().getTime();
						// new
						this.RedhSet('cidlist', newid, JSON.stringify(user), () => {
							callback(200);
						})
						this.RedhSet('userinfo', user.token, JSON.stringify(user))
					})
				}
			})

			// 图片
			socket.on('SendImg', (user, imgdata, name, callback) => {
				if (user && user.token && user.cid && imgdata) {
					if (imgdata.substr(0, 10) == 'data:image') {
						this.base64toImg(imgdata, name, user.token, (filename) => {
							if (user.face == 'update') {
								user.face = filename;
								user.updateTime = new Date().getTime();
								this.RedhSet('cidlist', user.cid, JSON.stringify(user))
								this.RedhSet('userinfo', user.token, JSON.stringify(user))
							}
							if (callback) {
								callback(filename);
							}
						});
						return;
					}
					if (user.face == 'update') {
						user.face = imgdata;
						user.updateTime = new Date().getTime();
						this.RedhSet('cidlist', user.cid, JSON.stringify(user))
						this.RedhSet('userinfo', user.token, JSON.stringify(user))
					}
					if (callback) {
						callback(imgdata);
					}
				}
			})

			socket.on('SaveImg', (user, filename, callback) => {
				if (user && user.token && user.cid && filename) {
					if (user.face == 'update') {
						user.face = filename;
						user.updateTime = new Date().getTime();
						this.RedhSet('cidlist', user.cid, JSON.stringify(user))
						this.RedhSet('userinfo', user.token, JSON.stringify(user))
					}
					if (callback) {
						callback();
					}
				}
			})

			// 更新客户端缓存的用户数据
			socket.on('UpdateUserInfo', (token, callback) => {
				if (token) {
					this.RedhGetAll('userinfo', (res) => {
						if (callback) callback(res);
					})
				}
			})

			// 用密码申请管理员权限
			socket.on('RequestAdminRole', (user, password, callback) => {
				if (user && user.token && password) {
					if (password == ADMINPASSWORD) {
						if (callback) {
							callback(ADMINPASSWORD);
						}
						return
					}
					if (callback) {
						callback('error');
					}
				}
			})

			// 管理员禁言
			socket.on('SuperStopUser', (user, password, callback) => {
				if (user && password) {
					if (password == ADMINPASSWORD) {
						user.stop = !user.stop;
						this.RedhSet('superstoplist', user.token, JSON.stringify(user), () => {
							this.RedhSet('userinfo', user.token, JSON.stringify(user));
							if (callback) {
								callback(1);
							}
						})
						return
					}
					if (callback) {
						callback(0);
					}
				}
			})


		});
		// this.app = app;
		// this.apiList();
	},

	base64toImg(base64Data, name, token, callback) {
		var arr = name.split('.');
		var imgType = '.' + arr[arr.length - 1];
		// if (base64Data.indexOf('data:image/png') > -1) {
		base64Data = base64Data.replace(/^data:image\/png;base64,/, "");
		// 	imgType = '.png'
		// }
		// if (base64Data.indexOf('data:image/jpg') > -1) {
		base64Data = base64Data.replace(/^data:image\/jpg;base64,/, "");
		// 	imgType = '.jpg'
		// }
		// if (base64Data.indexOf('data:image/gif') > -1) {
		base64Data = base64Data.replace(/^data:image\/gif;base64,/, "");
		// 	imgType = '.gif'
		// }
		// if (base64Data.indexOf('data:image/jpeg') > -1) {
		base64Data = base64Data.replace(/^data:image\/jpeg;base64,/, "");
		// 	imgType = '.jpg'
		// }
		var newname = 'uploads/' + token + '/' + shortid.generate() + imgType;
		var writeFun = () => {
			fs.writeFile('src/' + newname, base64Data, "base64", (err) => {
				if (err == null) {
					if (callback) {
						callback(newname)
					}
					return;
				}
				console.log(`base64toimg err`);
				console.log(err);
			})
		}
		fs.exists('src/uploads/' + token, (ext) => {
			if (!ext) {
				fs.mkdir('src/uploads/' + token, (err) => {
					if (err == null) {
						writeFun();
					}
				})
			} else {
				writeFun();
			}
		})
	},

	// 更新在线人数
	updateOnlineNum(room) {
		this.RedhGetAll(`${room}userlist`, (res) => {
			// console.log(res);
			var ids = _.keys(res);
			var num = ids.length;
			this.io.sockets.in(room).emit('UpdateOnlineNum', num);
		})
	},

	RedGetMsgList(room, callback) {
		RedClient.llen(`${room}msglist`, (err, len) => {
			if (err !== null) {
				console.log(`get msglist len err`);
				console.log(err);
				return
			}
			var num = len < 20 ? len * 1 : 20;
			// RedClient.lrange(MSGS, len - num, len, (er, res) => {
			RedClient.lrange(`${room}msglist`, 0, num, (er, res) => {
				if (er !== null) {
					console.log(`get msg err`);
					console.log(er);
					return
				}
				// console.log(res);
				// 取用户数据
				// _.forEach(res, (json, index) => {
				// 	var msg = JSON.parse(json)
				// 	if (msg) {
				// 		this.RedhGet('userinfo', msg.user.token, (str) => {
				// 			if (str) {
				// 				var user = JSON.parse(str);
				// 				if (user) {
				// 					msg.user = user;
				// 					res[index] = JSON.stringify(msg);
				// 				}
				// 			}
				// 			if (index == (res.length - 1)) {
				// 				if (callback) {
				// 					callback(res);
				// 				}
				// 			}
				// 		})
				// 	}
				// })
				if (callback) {
					callback(res);
				}
			})
		})
	},

	RedhGetAll(key, callback) {
		RedClient.hgetall(key, (err, res) => {
			if (err !== null) {
				console.log(`redis hgetall ${key} err`);
				console.log(err);
				return;
			}
			if (callback) {
				callback(res)
			}
		})
	},

	// 通用redis set
	RedSet(key, value, callback) {
		RedClient.set(key, value, (err) => {
			if (err !== null) {
				console.log(`redis set ${key} err`);
				console.log(value);
				console.log(err);
				return;
			}
			if (callback) {
				callback()
			}
		})
	},

	// 通用redis get
	RedGet(key, callback) {
		RedClient.get(key, (err, res) => {
			// console.log(err, res);
			if (err !== null) {
				console.log(`redis get ${key} err`);
				console.log(err);
				return;
			}
			if (callback) {
				callback(res)
			}
		})
	},

	RedDel(key, callback) {
		RedClient.del(key, (err) => {
			// console.log(err, res);
			if (err !== null) {
				console.log(`redis del ${key} err`);
				console.log(err);
				return;
			}
			if (callback) {
				callback()
			}
		})
	},

	RedhSet(key, field, value, callback) {
		RedClient.hset(key, field, value, (err) => {
			if (err !== null) {
				console.log(`redis hset ${key} ${field} err`);
				console.log(value);
				console.log(err);
				return;
			}
			if (callback) {
				callback()
			}
		})
	},

	RedhGet(key, field, callback) {
		RedClient.hget(key, field, (err, res) => {
			if (err !== null) {
				console.log(`redis hget ${key} ${field} err`);
				console.log(err);
				return;
			}
			if (callback) {
				callback(res)
			}
		})
	},

	RedhDel(key, field, callback) {
		RedClient.hdel(key, field, (err) => {
			if (err !== null) {
				console.log(`redis hdel ${key} ${field} err`);
				console.log(err);
				return;
			}
			if (callback) {
				callback()
			}
		})
	},

	//http接口列表
	apiList() {
	},
};


/**
 * 对Date的扩展，将 Date 转化为指定格式的String 月(M)、日(d)、12小时(h)、24小时(H)、分(m)、秒(s)、周(E)、季度(q)
 * 可以用 1-2 个占位符 年(y)可以用 1-4 个占位符，毫秒(S)只能用 1 个占位符(是 1-3 位的数字) eg: (new
 * Date()).pattern("yyyy-MM-dd hh:mm:ss.S") ==> 2006-07-02 08:09:04.423 (new
 * Date()).pattern("yyyy-MM-dd E HH:mm:ss") ==> 2009-03-10 二 20:09:04 (new
 * Date()).pattern("yyyy-MM-dd EE hh:mm:ss") ==> 2009-03-10 周二 08:09:04 (new
 * Date()).pattern("yyyy-MM-dd EEE hh:mm:ss") ==> 2009-03-10 星期二 08:09:04 (new
 * Date()).pattern("yyyy-M-d h:m:s.S") ==> 2006-7-2 8:9:4.18
 */
Date.prototype.pattern = function (fmt) {
	var o = {
		"M+": this.getMonth() + 1, // 月份
		"d+": this.getDate(), // 日
		"h+": this.getHours() % 12 == 0 ? 12 : this.getHours() % 12, // 小时
		"H+": this.getHours(), // 小时
		"m+": this.getMinutes(), // 分
		"s+": this.getSeconds(), // 秒
		"q+": Math.floor((this.getMonth() + 3) / 3), // 季度
		"S": this.getMilliseconds() // 毫秒
	};
	var week = {
		"0": "\u65e5",
		"1": "\u4e00",
		"2": "\u4e8c",
		"3": "\u4e09",
		"4": "\u56db",
		"5": "\u4e94",
		"6": "\u516d"
	};
	if (/(y+)/.test(fmt)) {
		fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
	}
	if (/(E+)/.test(fmt)) {
		fmt = fmt.replace(RegExp.$1, ((RegExp.$1.length > 1) ? (RegExp.$1.length > 2 ? "星期" : "周") : "") + week[this.getDay() + ""]);
	}
	for (var k in o) {
		if (new RegExp("(" + k + ")").test(fmt)) {
			fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
		}
	}
	return fmt;
};