const APIurl = "http://lvv.fun:6010";
const io = require("./socket.io");
const _ = require("lodash");
const WebSocketHost = "http://63.223.103.49:6011";
const UploadPath = "http://lvv.fun:6010/";

cc.Class({
  extends: cc.Component,
  properties: {
    RoomList: cc.Node,
    Room: cc.Prefab,
    tabbtn1: cc.Node,
    tabbtn2: cc.Node,
    tabbtn3: cc.Node,
    loadingNode: cc.Node,
    // chatLoadingNode: cc.Node,
    touchCancelNode: cc.Node,
    floatMenu: cc.Node,
    touchCancelNode2: cc.Node,
    floatMenu2: cc.Node,
    chatingTitle: cc.Label,
    chatRoomNode: cc.Node,
    msgByOter: cc.Prefab,
    msgBySelf: cc.Prefab,
    MsgList: cc.Node,
    chatScroll: cc.ScrollView,
    msgScroll: cc.ScrollView,
    inputNode: cc.EditBox,
    publicNode: cc.Node,
    dialogNode: cc.Node,
    dialogInput: cc.EditBox,
    dialogTitle: cc.Label,
    confirmTitle: cc.Label,
    confirmNode: cc.Node,
    chatfooterNode: cc.Node,
    chatfooterPlusNode: cc.Node,
    chatbodyNode: cc.Node,
    chatfooterTouchCancelNode: cc.Node,
    settingNode: cc.Node,
    tipNode: cc.Node,
    tipTitle: cc.Label,
  },
  onLoad() {
    // cc.log(cc.game.renderType);

    this.hideChatRoom();
    this.showLoading();

    // tab菜单
    this.tabmenu = [
      {
        name: "聊天",
      }, {
        name: "朋友圈",
      }, {
        name: "设置",
      },
    ]

    this.renderMenu();
    this.toggleMenu(null, 0);
    this.initSocket();
  },
  getLS(key) {
    return cc.sys.localStorage.getItem(key);
  },
  setLS(key, value) {
    cc.sys.localStorage.setItem(key, value)
  },
  showLoading() {
    // this.hideDom();
    this.publicNode.active = true;
    this.loadingNode.active = true;

    var animState = this.loadingNode.getChildByName("gif").getComponent(cc.Animation).play("gif");
    // 设置循环模式为 Loop
    animState.wrapMode = cc.WrapMode.Loop;
    // 设置动画循环次数为无限次
    animState.repeatCount = Infinity;
  },
  hideLoading() {
    if (this.loadingNode.getChildByName("progress").active) return;
    // this.showDom();
    this.publicNode.active = false;
    this.dialogNode.active = false;
    this.confirmNode.active = false;
    this.loadingNode.active = false;
    this.tipNode.active = false;
    this.loadingNode.getChildByName("gif").getComponent(cc.Animation).stop();
  },
  showTip(title) {
    this.tipNode.stopAllActions();
    this.tipNode.active = true;
    // console.log(this.tipTitle.node)
    this.tipTitle.node.parent.getComponent(cc.Label).string = title;
    this.tipTitle.string = title;

    var ac = cc.fadeOut(0.5);
    var nextFun = cc.callFunc(() => {
      this.tipNode.active = false;
      this.tipNode.opacity = 255;
    })
    if (this.showTipTimer) {
      clearTimeout(this.showTipTimer)
    }
    this.showTipTimer = setTimeout(
      () => {
        this.tipNode.runAction(cc.sequence(ac, nextFun));
      }, 1000
    )
  },
  // 渲染菜单
  renderMenu() {
    this.tabbtn1.getChildByName("normal").getChildByName("txt").getComponent(cc.Label).string = this.tabmenu[0].name;
    this.tabbtn2.getChildByName("normal").getChildByName("txt").getComponent(cc.Label).string = this.tabmenu[1].name;
    this.tabbtn3.getChildByName("normal").getChildByName("txt").getComponent(cc.Label).string = this.tabmenu[2].name;
    this.tabbtn1.getChildByName("hover").getChildByName("txt").getComponent(cc.Label).string = this.tabmenu[0].name;
    this.tabbtn2.getChildByName("hover").getChildByName("txt").getComponent(cc.Label).string = this.tabmenu[1].name;
    this.tabbtn3.getChildByName("hover").getChildByName("txt").getComponent(cc.Label).string = this.tabmenu[2].name;
  },
  toggleMenu(ev, index) {
    // 朋友圈
    if (index == 1) {
      return this.showTip("暂未开放");
    }
    this.tabbtn1.getChildByName("normal").active = true
    this.tabbtn2.getChildByName("normal").active = true
    this.tabbtn3.getChildByName("normal").active = true
    this.tabbtn1.getChildByName("hover").active = false
    this.tabbtn2.getChildByName("hover").active = false
    this.tabbtn3.getChildByName("hover").active = false
    this['tabbtn' + (index * 1 + 1)].getChildByName("normal").active = false;
    this['tabbtn' + (index * 1 + 1)].getChildByName("hover").active = true;
    // 页面切换
    this.settingNode.active = false;
    // 设置
    if (index == 2) {
      // setting
      this.loadUserInfo();
      this.settingNode.active = true;
    }
  },
  loadUserInfo() {
    var json = this.getLS('pdcid');
    if (json) {
      var user = JSON.parse(json)
      if (user && user.token) {
        this.settingNode.getChildByName("box").getChildByName("myinfo").getChildByName("nickname").getComponent(cc.Label).string = user.nickname;
        this.settingNode.getChildByName("box").getChildByName("myinfo").getChildByName("id").getComponent(cc.Label).string = "个性ID：" + (user.cid ? user.cid : "未设置");
        // 头像
        if (user.face) {
          this.loadUrlImg(user.face, (newframe) => {
            this.settingNode.getChildByName("box").getChildByName("myinfo").getChildByName("face").getComponent(cc.Sprite).spriteFrame = newframe;
          })
        }
      }
    }
  },
  // 初始化socket连接
  initSocket() {
    // TODO获取token
    // token验证
    // 得到用户信息

    this.client = io(WebSocketHost);
    this.client.on('connect', () => {
      if (!this.client.connected) {
        this.netWorkError(1);
        return console.log(`socket connected ERR`);
      }

      // test
      var pdcid = this.getLS('pdcid');
      // 注册游客
      if (!pdcid) {
        this.client.emit('GetGuestAccount', (user) => {
          this.setLS('pdcid', JSON.stringify(user))
          this.getPandaRoom();
        })
      } else {
        this.getPandaRoom();
      }
    });
    this.client.on('disconnect', () => {
      if (!this.client.connected) {
        this.netWorkError(1);
        console.log(`socket disconnect`);
        // this.showLoading();
      }
    });
    this.client.on('reconnecting', () => {
      this.netWorkError(1);
      console.log(`socket reconnecting`);
    });
    // this.client.on('reconnect_failed', () => {
    //   this.netWorkError(1);
    //   console.log(`socket reconnect_failed`);
    // });
    this.client.on('reconnect_error', () => {
      this.netWorkError(1);
      console.log(`socket reconnect_error`);
    });
    this.client.on('reconnect', () => {
      this.netWorkError(0);
      console.log(`socket reconnect OK`);
      if (this.chatingRoom) {
        this.ConnectRoom(this.chatingRoom.roomname);
      }
    });

    // ====================
    this.client.on('PrependChat', (chater) => {
      // console.log(chater);
      chater = _.sortBy(chater, (room) => {
        if (room.lastmsg) {
          return room.lastmsg.time
        }
        return 0
      })
      chater.reverse();
      this.ChatList = chater;
      this.renderList();
      this.hideLoading();
    })
    this.client.on('UpdateOnlineNum', (num) => {
      if (this.chatingRoom) {
        this.chatingTitle.string = this.chatingRoom.fullname + `(${num})`;
      }
    })
    this.client.on('SendMsgEvent', (json, room) => {
      var obj = JSON.parse(json);
      // console.log(obj);
      // 添加到最后一条聊天记录
      if (this.chatingRoom && (this.chatingRoom.roomname == room)) {
        this.appendMsg([json]);
      }
      // 更新聊天室列表展示的最后一条记录
      var f = _.find(this.ChatListNode, (node) => {
        return node.roomname == room
      })
      // 点亮
      // console.log(this.chatingRoom, room, f.getChildByName('name-bg').getChildByName('new'))
      if (!this.chatingRoom || (this.chatingRoom && (this.chatingRoom.roomname !== room))) {
        if (f) {
          f.unreadNum = f.unreadNum * 1 + 1;
          f.getChildByName('name-bg').getChildByName('new').active = true;
        }
      }
      if (f) {
        f.unreadTag = (f.unreadNum > 1 ? `[${f.unreadNum}条] ` : '');
        var str = f.unreadTag + `${obj.user.nickname}: ${(obj.type == 'upload_image' ? '[图片消息]' : obj.content)}`;
        f.getChildByName('item-content').getChildByName('box').getChildByName('cont').getComponent(cc.Label).string = (str.length > 20 ? (str.substr(0, 20) + '...') : str);
        // 触发房间排到第一个，在他之前的top都+1个height
        // console.log(f);
        // var tempTop = _.cloneDeep(f.getComponent(cc.Widget)).top;
        var tempHeight = _.cloneDeep(f).height;
        f.getComponent(cc.Widget).top = 0;
        f.getComponent(cc.Widget).updateAlignment();
        var finded = false;
        _.forEach(this.ChatListNode, (node, index) => {
          if (node.roomname == room) {
            finded = true;
          }
          if (!finded) {
            node.getComponent(cc.Widget).top = node.getComponent(cc.Widget).top * 1 + tempHeight * 1;
            node.getComponent(cc.Widget).updateAlignment();
          }
        })
        // 重新排序
        this.ChatListNode = _.sortBy(this.ChatListNode, [(node) => {
          return node.getComponent(cc.Widget).top
        }])
        // 更新服务端排序
        var json = this.getLS('pdcid');
        if (json) {
          var user = JSON.parse(json);
          if (user.token) {
            var list = _.map(this.ChatListNode, (o) => {
              return { name: o.roomname, title: this.RoomDic[o.roomname].fullname }
            })
            this.client.emit("UpdateUserRoomList", user, list)
          }
        }
      }
      // 滚动至底部
      this.msgScroll.scrollToBottom(0.05)
    })
  },
  // 打开浮动菜单
  showFloatMenu() {
    this.floatMenu.active = true;
    this.touchCancelNode.active = true;
  },
  // 打开浮动菜单
  showFloatMenu2() {
    this.floatMenu2.active = true;
    this.touchCancelNode2.active = true;
  },
  closeFloatMenu() {
    this.floatMenu.active = false;
    this.touchCancelNode.active = false;
  },
  closeFloatMenu2() {
    this.floatMenu2.active = false;
    this.touchCancelNode2.active = false;
  },
  // 获取官方聊天室
  getPandaRoom() {
    var str = this.getLS('pdcid')
    this.client.emit('GetPandaRoom', JSON.parse(str));
  },
  // 取消一些弹出层的点击
  touchCancel(event, tag) {
    // console.log(tag)
    if (this[tag]) {
      this[tag].active = false;
    }
    this.touchCancelNode.active = false;
    this.touchCancelNode2.active = false;
  },
  netWorkError(type) {
    if (type) {
      // this.showLoading();
    } else {
      // 重连房间
      if (this.alreadyRoomList && this.alreadyRoomList.length > 0) {
        _.forEach(this.alreadyRoomList, (room) => {
          this.ConnectRoom(room);
        })
      }
      // this.hideLoading();
    }
  },
  renerChatRoomByDom(room) {
    this.DomChatRoom = this.DomChatRoom || {};
    // 方案B,采用ul li对齐canvas的scroll区域
    // 放弃，性能太差，体验不友好
    // cc.log(cc.view);
    var hPer = cc.view._designResolutionSize.height / cc.view._frameSize.height;
    // cc.log(hPer)
    // cc.log(this.chatRoomNode.getChildByName("header").height);
    // cc.log(this.chatRoomNode.getChildByName("footer").height);
    var headerHeight = this.chatRoomNode.getChildByName("header").height;
    var footerHeight = this.chatRoomNode.getChildByName("footer").height;
    if (!this.DomChatRoom[room]) {
      var elem = document.createElement('div');
      elem.id = `chat-container-${room}`;
      elem.style.cssText = `position:absolute;top:${headerHeight / hPer}px;left:0;width:100%;bottom:${footerHeight / hPer}px;z-index:-1;background:#fff;
      overflow-x: hidden;overflow-y: auto;`;
      var ul = document.createElement('ul');
      ul.style.cssText = `margin:0;padding:0;`;
      elem.appendChild(ul);
      document.body.appendChild(elem);
      this.DomChatRoom[room] = {
        div: elem,
        ul: ul
      };
    }
  },
  // 渲染聊天室列表
  renderList() {
    this.ChatListNode = this.ChatListNode || [];
    this.RoomDic = this.RoomDic || {};
    var arr = this.ChatList;

    if (arr.length == 0) return;
    // var totalHeight = 0;
    // var _pre_w_top = 0;
    for (var i = 0; i < arr.length; i++) {
      var f = _.find(this.ChatListNode, (o) => {
        return o.roomname == arr[i].roomname
      })
      if (!f) {
        this.ConnectRoom(arr[i].roomname);
        var clone = cc.instantiate(this.Room);
        // 激活
        clone.active = true;
        // console.log(arr[i]);
        // 房间名
        clone.roomname = arr[i].roomname;
        clone.unreadNum = 0;
        // console.log(clone);
        // 对齐组件
        var w = clone.getComponent(cc.Widget);
        w.top = this.ChatListNode.length * (clone.height + 10);
        // 文字组件
        var label = clone.getChildByName('name-bg').getChildByName('name').getComponent(cc.Label);
        // console.log(label);
        label.string = (arr[i].name);
        // 填入内容
        var contnode = clone.getChildByName('item-content');
        // tit
        contnode.getChildByName('tit').getComponent(cc.Label).string = arr[i].fullname;
        // content
        var str = arr[i].lastmsg ? `${arr[i].lastmsg.user.nickname}: ${(arr[i].lastmsg.type == 'upload_image' ? '[图片消息]' : arr[i].lastmsg.content)}` : "";
        contnode.getChildByName('box').getChildByName('cont').getComponent(cc.Label).string = (str.length > 20 ? (str.substr(0, 20) + '...') : str);
        // 对齐
        contnode.getChildByName('box').getChildByName('cont').getComponent(cc.Widget).top = 0;
        // 绑定事件
        var clickEventHandler = new cc.Component.EventHandler();
        clickEventHandler.target = this.node; //这个 node 节点是你的事件处理代码组件所属的节点
        clickEventHandler.component = "chat";//这个是代码文件名
        clickEventHandler.handler = "joinRoom";
        clickEventHandler.customEventData = arr[i].roomname;
        var button = clone.getComponent(cc.Button);
        button.clickEvents.push(clickEventHandler);
        // console.log(clone);
        this.RoomList.addChild(clone);
        this.ChatListNode.push(clone);
        this.RoomDic[arr[i].roomname] = arr[i];
        // _pre_w_top = w.top;
        // totalHeight = totalHeight * 1 + clone.height + 10;
      }
    }
    // console.log(this.Room);
    this.RoomList.height = (this.Room.data.height + 10) * this.ChatListNode.length;
    this.chatScroll.scrollToTop(0);
  },
  // 创建群聊
  createRoom() {
    this.closeFloatMenu();
    this.showDialog();
    this.dialogTitle.string = '输入房间名称';
    this.okFun = this.createRoomFun;
  },
  showDialog() {
    this.publicNode.active = true;
    this.dialogNode.active = true;
  },
  createRoomFun() {
    if (this.creating) return;
    var str = this.getLS('pdcid')
    if (str) {
      var user = JSON.parse(str)
      user.face = null;
      if (user.token) {
        this.dialogInput.string = this.dialogInput.string.replace(/ /g, '')
        if (this.dialogInput.string == '') return;
        this.creating = true;
        this.showLoading();
        this.client.emit('CreateRoom', user, this.dialogInput.string, (room) => {
          console.log('create room OK')
          this.dialogInput.string = '';
          this.creating = false;
          this.hideLoading();
          if (room && room.name) {
            // 渲染列表
            this.renderPrependRoom(room);
            // this.ConnectRoom(room.name);
            // 进入房间
            this.joinRoom(null, room.name)
            // 第一次创建后自动发言
            var json = JSON.stringify({
              "content": `欢迎大家来我创建的房间“${room.roomtitle}”畅所欲言！`,
              "user": user
            });
            this.showLoading();
            this.client.emit("SendMsg", room.name, json, (sess) => {
              this.hideLoading();
              if (!sess) {
                this.showTip("您被禁言中");
              }
            })
          }
        })
      }
    }

  },

  okFun() {

  },

  cancelFun() {
    this.hideDialog();
    this.dialogInput.string = '';
  },

  hideDialog() {
    this.publicNode.active = false;
    this.dialogNode.active = false;
    this.dialogInput.string = '';
  },

  // 退出群聊
  quitFun() {
    this.closeFloatMenu2();
    this.touchCancel.active = false;
    this.confirmTitle.string = "确认要退出该群聊吗？";
    this.showConfirm();
    this.OkConfirm = () => {
      // console.log(this.chatingRoom);
      var json = this.getLS('pdcid');
      if (json) {
        var user = JSON.parse(json)
        if (user && user.token) {
          // console.log(user);
          if (this.chatingRoom) {
            var roomname = _.cloneDeep(this.chatingRoom).roomname;
            this.showLoading();
            this.client.emit("QuitRoom", roomname, user, () => {
              console.log('quit room OK');
              // 销毁子节点
              var f = _.find(this.ChatListNode, (node) => {
                return node.roomname == roomname
              })
              if (f) {
                // 渲染视图，该节点往后的几点全部上移一个height单位
                this.chatScroll.scrollToTop(0);
                var tempHeight = _.cloneDeep(f).height;
                var finded = false;
                // console.log(this.ChatListNode);
                var finded = false;
                _.forEachRight(this.ChatListNode, (node) => {
                  if (node.roomname == roomname) {
                    finded = true;
                  }
                  if (!finded) {
                    node.getComponent(cc.Widget).top = node.getComponent(cc.Widget).top * 1 - tempHeight * 1;
                    node.getComponent(cc.Widget).updateAlignment();
                  }
                })
                // 标记退出
                this.RoomDic[roomname].quit = true;
                // 销毁节点
                f.destroy();
                // 移除
                _.remove(this.ChatListNode, (node) => {
                  return node.roomname == roomname;
                })
                // 总高度减少一个height单位
                // this.RoomList.height = this.RoomList.height - tempHeight;
              }
              // 退出房间
              this.hideChatRoom();
              this.hideLoading();
              // console.log(this.ChatListNode);
            })
          }
        }
      }
    };
    this.NoConfirm = () => {
      this.hideConfirm();
    };
  },
  OkConfirm() { },
  NoConfirm() { },
  showConfirm() {
    this.publicNode.active = true;
    this.confirmNode.active = true;
  },
  hideConfirm() {
    this.publicNode.active = false;
    this.confirmNode.active = false;
  },
  addFriend() {

  },
  addFriendFun() {

  },
  // 渲染加入一个群聊至列表
  renderPrependRoom(room, callback) {
    var f = _.find(this.ChatListNode, (o) => {
      return o.roomname == room.name
    })
    if (!f) {
      this.ConnectRoom(room.name);
      var clone = cc.instantiate(this.Room);
      // 激活
      clone.active = true;
      // console.log(arr[i]);
      // 房间名
      clone.roomname = room.name;
      // console.log(clone);
      // 对齐组件
      var w = clone.getComponent(cc.Widget);
      w.top = this.ChatListNode.length * (clone.height + 10);
      // 文字组件
      var label = clone.getChildByName('name-bg').getChildByName('name').getComponent(cc.Label);
      // console.log(label);
      label.string = (room.roomtitle).substr(0, 1);
      // 填入内容
      var contnode = clone.getChildByName('item-content');
      // tit
      contnode.getChildByName('tit').getComponent(cc.Label).string = room.roomtitle;
      // content
      // var str = arr[i].lastmsg ? `${arr[i].lastmsg.user.nickname}: ${arr[i].lastmsg.content}` : "";
      // contnode.getChildByName('box').getChildByName('cont').getComponent(cc.Label).string = (str.length > 20 ? (str.substr(0, 20) + '...') : str);
      // 对齐
      contnode.getChildByName('box').getChildByName('cont').getComponent(cc.Widget).top = 0;
      // 绑定事件
      var clickEventHandler = new cc.Component.EventHandler();
      clickEventHandler.target = this.node; //这个 node 节点是你的事件处理代码组件所属的节点
      clickEventHandler.component = "chat";//这个是代码文件名
      clickEventHandler.handler = "joinRoom";
      clickEventHandler.customEventData = room.name;
      var button = clone.getComponent(cc.Button);
      button.clickEvents.push(clickEventHandler);
      // console.log(clone);
      this.RoomList.addChild(clone);
      this.ChatListNode.push(clone);
      this.RoomDic[room.name] = room;
      // _pre_w_top = w.top;
      // totalHeight = totalHeight * 1 + clone.height + 10;
    }
    // console.log(this.Room);
    this.RoomList.height = (this.Room.data.height + 10) * this.ChatListNode.length;
    this.chatScroll.scrollToTop(0);
    if (callback) callback()
  },
  ConnectRoom(roomname) {
    // 建立连接
    var json = this.getLS('pdcid');
    if (json) {
      var user = JSON.parse(json);
      if (user.token) {
        this.client.emit("ConnectRoom", roomname, json, () => {
          this.alreadyRoomList = this.alreadyRoomList || [];
          if (this.alreadyRoomList.indexOf(roomname) < 0) {
            this.alreadyRoomList.push(roomname);
          }
          console.log(`room ${roomname} connnected OK`);
        });
      }
    }
  },
  // 加入群聊
  joinRoom(event, tag, callback) {
    this.showLoading();
    // this.renerChatRoomByDom(tag);
    this.chatingRoom = this.RoomDic[tag];
    // this.msgresult = [];
    // console.log(tag);
    this.chatingTitle.string = this.chatingRoom.fullname;
    this.showChatRoom();
    // 清空未读消息
    var f = _.find(this.ChatListNode, (o) => {
      return o.roomname == tag
    })
    if (f) {
      f.unreadNum = 0;
      f.getChildByName('name-bg').getChildByName('new').active = false;
      var _str = f.getChildByName('item-content').getChildByName('box').getChildByName('cont').getComponent(cc.Label).string;
      f.getChildByName('item-content').getChildByName('box').getChildByName('cont').getComponent(cc.Label).string = _str.replace(f.unreadTag, '');
    }
    // 建立连接
    var user = this.getLS('pdcid');
    // 更新缓存用户数据
    this.client.emit("UpdateUserInfo", JSON.parse(user).token, (res) => {
      if (res) {
        // console.log(res);
        this.setLS('panda-user-info', JSON.stringify(res));
      }
      this.client.emit("JoinRoom", this.chatingRoom.roomname, user, (msgs, token) => {
        // console.log(msgs, token)
        msgs.reverse();
        // this.initDomList(msgs);
        if (msgs.length > 0) {
          this.appendMsg(msgs);
        }
        // 滚动到底部
        // console.log(this.msgScroll.scrollToBottom(0))
        this.msgScroll.scrollToBottom(0)
        this.hideLoading();
        if (callback) callback()
      });
    })
  },
  initDomList(msgs) {
    _.forEach(msgs, (msg) => {
      // console.log(msg);
      msg = JSON.parse(msg)
      var li = document.createElement('li');
      li.innerHTML = msg.content;
      li.style.cssText = `height:20rem;`;
      this.DomChatRoom[this.chatingRoom.roomname].ul.appendChild(li);
    })
  },
  showChatRoom() {
    this.chatRoomNode.active = true;
  },
  hideChatRoom() {
    // this.hideDom();
    // 清空聊天记录
    // console.log(this.MsgList)
    if (this.MsgList.childrenCount > 0) {
      _.forEach(this.MsgList.children, (node) => {
        node.destroy();
      })
    }
    this.MsgList.height = 0;
    this.MsgList.getComponent(cc.Layout).updateLayout();
    this.chatRoomNode.active = false;
    this.chatingRoom = false;
    this.closeFloatMenu2();
    this.closePlusButtons();
  },
  hideDom() {
    if (this.chatingRoom && this.DomChatRoom) {
      this.DomChatRoom[this.chatingRoom.roomname].div.style.zIndex = -1;
    }
  },
  showDom() {
    if (this.chatingRoom && this.DomChatRoom) {
      this.DomChatRoom[this.chatingRoom.roomname].div.style.zIndex = 2;
    }
  },
  appendMsg(arr) {
    if (arr.length > 0) {
      var user = this.getLS('pdcid');
      var users = this.getLS('panda-user-info');
      if (users) users = JSON.parse(users);
      user = JSON.parse(user);
      var breakMark = false;
      _.forEach(arr, (msg, mainindex) => {
        if (breakMark) return;
        msg = JSON.parse(msg)
        // 覆盖用户属性
        if (users[msg.user.token]) {
          msg.user = JSON.parse(users[msg.user.token]);
        }
        // console.log(msg, user)
        if (msg.user.token !== user.token) {
          var clone = cc.instantiate(this.msgByOter);
          var sender = 2
        } else {
          var clone = cc.instantiate(this.msgBySelf);
          var sender = 1
          // var clone = cc.instantiate(this.msgByOter);
        }
        // 激活节点
        clone.active = true;
        // console.log(clone);
        // console.log(msg.user);
        // 首字
        clone.getChildByName('name-bg').getChildByName('name').getComponent(cc.Label).string = msg.user.nickname.substr(0, 1);
        // 更换头像
        if (msg.user.face) {
          clone.getChildByName('name-bg').getChildByName('name').removeComponent(cc.Label)
          this.loadUrlImg(msg.user.face, (faceFrame) => {
            clone.getChildByName('name-bg').getComponent(cc.Sprite).spriteFrame = faceFrame;
          })
        }
        var clickEventHandler1 = new cc.Component.EventHandler();
        clickEventHandler1.target = this.node; //这个 node 节点是你的事件处理代码组件所属的节点
        clickEventHandler1.component = "chat";//这个是代码文件名
        clickEventHandler1.handler = "SuperActionUser";
        clickEventHandler1.customEventData = JSON.stringify(msg.user);
        clone.getChildByName('name-bg').addComponent(cc.Button)
        var button = clone.getChildByName('name-bg').getComponent(cc.Button);
        button.clickEvents.push(clickEventHandler1);

        // 发言者
        var titnode = clone.getChildByName('item-content').getChildByName('tit');
        titnode.getComponent(cc.Label).string = msg.user.nickname;
        // 最大宽度
        var width = clone.getChildByName('item-content').width;
        // var nowwidth = clone.getChildByName('item-content').getChildByName('rich').width;
        // if (nowwidth >= (width - 40)) {
        clone.getComponent(cc.Widget).top = this.MsgList.height + 20;
        if (msg.type == 'upload_image') {
          // cc.log(msg);
          this.showLoading();
          this.loadUrlImg(msg.content, (img) => {
            this.hideLoading();
            clone.getChildByName('item-content').getChildByName('rich-bg-1').active = false;
            clone.getChildByName('item-content').getChildByName('rich-bg-2').active = false;
            clone.getChildByName('item-content').getChildByName('rich').active = false;
            clone.getChildByName('item-content').getChildByName('img').active = true;
            clone.getChildByName('item-content').getChildByName('img').getComponent(cc.Sprite).spriteFrame = img;
            // 原始尺寸
            // cc.log(img.getOriginalSize());
            var size = img.getOriginalSize();
            var height = size.height;
            if (size && size.width > 560) {
              height = size.height / (size.width / 560);
              clone.getChildByName('item-content').getChildByName('img').width = 560;
              clone.getChildByName('item-content').getChildByName('img').height = height;
            }
            if (size && size.height > 2000) {
              height = 2000;
              var width = size.width / (size.height / height);
              clone.getChildByName('item-content').getChildByName('img').width = width;
              clone.getChildByName('item-content').getChildByName('img').height = height;
            }
            this.MsgList.addChild(clone);
            this.MsgList.height = this.MsgList.height * 1 + height + 60;
            this.MsgList.getComponent(cc.Layout).updateLayout();
            this.msgScroll.scrollToBottom(0.05)
            arr = _.drop(arr, (mainindex * 1 + 1));
            // cc.log(arr);
            if (arr.length > 0) {
              this.appendMsg(arr);
            }
          })
          // 跳出循环进入callback递归
          breakMark = true;
          // console.log(clone.getChildByName('item-content').getChildByName('img').height);
        } else {
          clone.getChildByName('item-content').getChildByName('rich-bg-1').active = true;
          clone.getChildByName('item-content').getChildByName('rich-bg-2').active = true;
          clone.getChildByName('item-content').getChildByName('rich').active = true;
          clone.getChildByName('item-content').getChildByName('img').active = false;
          if (msg.content.length > 18) {
            clone.getChildByName('item-content').getChildByName('rich-bg-1').getComponent(cc.RichText).maxWidth = width - 40;
            clone.getChildByName('item-content').getChildByName('rich-bg-2').getComponent(cc.RichText).maxWidth = width - 40;
            clone.getChildByName('item-content').getChildByName('rich').getComponent(cc.RichText).maxWidth = width - 40;
          }
          // 发言内容
          if (sender == 1) {
            clone.getChildByName('item-content').getChildByName('rich-bg-1').getComponent(cc.RichText).string = `<color=#6ccc04>${msg.content}</color>`;
            clone.getChildByName('item-content').getChildByName('rich-bg-2').getComponent(cc.RichText).string = `<color=#6ccc04>${msg.content}</color>`;
          } else {
            clone.getChildByName('item-content').getChildByName('rich-bg-1').getComponent(cc.RichText).string = `<color=#ffffff>${msg.content}</color>`;
            clone.getChildByName('item-content').getChildByName('rich-bg-2').getComponent(cc.RichText).string = `<color=#ffffff>${msg.content}</color>`;
          }
          clone.getChildByName('item-content').getChildByName('rich').getComponent(cc.RichText).string = `<color=#333>${msg.content}</color>`;
          // 绑定事件
          var clickEventHandler = new cc.Component.EventHandler();
          clickEventHandler.target = this.node; //这个 node 节点是你的事件处理代码组件所属的节点
          clickEventHandler.component = "chat";//这个是代码文件名
          clickEventHandler.handler = "checkLink";
          clickEventHandler.customEventData = JSON.stringify(msg);
          var button = clone.getChildByName('item-content').getChildByName('rich').getComponent(cc.Button);
          button.clickEvents.push(clickEventHandler);
          this.MsgList.addChild(clone);
          // this.msgresult.push(msg);
          this.MsgList.height = this.MsgList.height * 1 + clone.height * 1 + 20;
          if (clone.getChildByName('item-content').getChildByName('rich').height > 60) {
            this.MsgList.height = this.MsgList.height * 1 + clone.getChildByName('item-content').getChildByName('rich').height - 40;
          }
        }
        this.MsgList.getComponent(cc.Layout).updateLayout();
        this.msgScroll.scrollToBottom(0.05)
        // console.log(this.MsgList.height);
      })
    }
  },
  SuperActionUser(evnt, user) {
    let _super = this.getLS('pdsuper');
    if (_super) {
      // console.log(_super, user);
      user = JSON.parse(user);
      if (user.stop) {
        this.confirmTitle.string = `是否解除该用户禁言\r\n【${user.nickname}】？`;
      } else {
        this.confirmTitle.string = `是否确认禁言该用户\r\n【${user.nickname}】？`;
      }
      this.closeFloatMenu2();
      this.showConfirm();
      this.OkConfirm = () => {
        this.showLoading();
        this.client.emit("SuperStopUser", user, _super, (success) => {
          this.hideLoading();
          if (success) {
            this.showTip("操作成功");
          } else {
            this.showTip("操作失败");
          }
        })
      }
      this.NoConfirm = () => {
        this.hideConfirm()
      }
    }
  },
  sendMsg() {
    if (this.sending) return;
    var str = this.inputNode.string;
    // console.log(this.inputNode.string)
    if (str.length > 0) {
      var user = this.getLS('pdcid');
      user = JSON.parse(user);
      if (user.token) {
        // 进入管理模式
        if (str == '/admin') {
          this.dialogTitle.string = '输入管理员密码';
          this.showDialog();
          this.okFun = () => {
            this.dialogInput.string = this.dialogInput.string.replace(/ /g, '')
            if (this.dialogInput.string == '') return;
            let password = this.dialogInput.string;
            this.showLoading();
            // 获取管理员授权
            this.client.emit("RequestAdminRole", user, password, (token) => {
              this.hideDialog();
              this.hideLoading();
              if (token == "error") {
                this.showTip("密码不正确");
                return
              }
              this.showTip("已获取授权");
              this.setLS('pdsuper', token);
            })
          }
          return;
        }

        // 普通发言
        var json = JSON.stringify({
          "content": str,
          "user": user
        });
        this.sending = true;
        this.showLoading();
        this.closePlusButtons();
        this.client.emit("SendMsg", this.chatingRoom.roomname, json, (sess) => {
          this.inputNode.string = '';
          this.sending = false;
          this.hideLoading();
          if (!sess) {
            this.showTip("您被禁言中");
          }
        })
      }
    }
  },
  checkLink(event, json) {
    var msg = JSON.parse(json);
    if (msg.isLink == 1) {
      if (msg.inviteRoom) {
        this.closePlusButtons();
        this.closeFloatMenu2();
        this.hideLoading();
        this.confirmTitle.string = "是否接受邀请进入该房间？";
        this.showConfirm();
        this.OkConfirm = () => {
          if (this.RoomDic[msg.inviteRoom.roomname] && !this.RoomDic[msg.inviteRoom.roomname].quit) {
            this.confirmTitle.string = "该房间已存在您的列表\r\n请勿重复添加";
            this.OkConfirm = () => {
              this.hideConfirm();
            }
            return;
          }
          // 退出当前房间
          this.hideChatRoom();
          // 更新列表
          msg.inviteRoom.roomtitle = msg.inviteRoom.fullname;
          msg.inviteRoom.name = msg.inviteRoom.roomname;
          this.renderPrependRoom(_.cloneDeep(msg.inviteRoom), () => {
            // 进入房间
            this.joinRoom(null, msg.inviteRoom.roomname, () => {
              var user = this.getLS('pdcid');
              user = JSON.parse(user);
              if (user.token) {
                var json = JSON.stringify({
                  "content": `${user.nickname}加入到本房间！`,
                  "user": user
                });
                this.showLoading();
                this.client.emit("SendMsg", this.chatingRoom.roomname, json, (sess) => {
                  this.hideLoading();
                  if (!sess) {
                    this.showTip("您被禁言中");
                  }
                })
              }
            });
          });
        }
        this.NoConfirm = () => {
          this.hideConfirm();
        }
      }
    }
    // console.log(json);
  },
  openPlusButtons() {
    if (!this.plusOpen) {
      this.plusOpen = true;
    } else {
      return this.closePlusButtons();
    }
    // this.chatfooterTouchCancelNode.active = true;
    // console.log(height);
    // console.log(this.chatfooterNode.getComponent(cc.Widget));
    var bottom = this.chatbodyNode.getComponent(cc.Widget).bottom;
    // console.log(bottom);
    this.chatbodyNode.getComponent(cc.Widget).bottom = bottom + 200;
    this.chatbodyNode.getComponent(cc.Widget).updateAlignment();
    this.chatfooterNode.getComponent(cc.Widget).bottom = 200;
    this.chatfooterNode.getComponent(cc.Widget).updateAlignment();
  },
  closePlusButtons() {
    this.plusOpen = false;
    this.chatbodyNode.getComponent(cc.Widget).bottom = 120;
    this.chatbodyNode.getComponent(cc.Widget).updateAlignment();
    // this.chatfooterTouchCancelNode.active = false;
    this.chatfooterNode.getComponent(cc.Widget).bottom = 0;
    this.chatfooterNode.getComponent(cc.Widget).updateAlignment();
  },
  // 复制邀请码
  copyInviteLink() {
    this.setLS('panda-invite-link', JSON.stringify(this.chatingRoom));
    this.showTip('房间邀请链接已复制成功');
    this.closeFloatMenu2();
  },
  sendInviteLink() {
    var user = this.getLS('pdcid');
    var room = this.getLS('panda-invite-link');
    if (!room) return;
    room = JSON.parse(room);
    user = JSON.parse(user);
    if (user.token) {
      this.confirmTitle.string = `是否发送房间【${room.fullname}】的邀请`;
      this.closeFloatMenu2();
      this.closePlusButtons();
      this.showConfirm();
      this.OkConfirm = () => {
        this.hideConfirm()
        var json = JSON.stringify({
          "content": `点击这条信息来加入我的房间【${room.fullname}】畅所欲言！`,
          "user": user,
          "isLink": 1,
          "inviteRoom": room
        });
        this.showLoading();
        this.closePlusButtons()
        this.client.emit("SendMsg", this.chatingRoom.roomname, json, (sess) => {
          this.hideLoading();
          if (!sess) {
            this.showTip("您被禁言中");
          }
        })
      }
      this.NoConfirm = () => {
        this.hideConfirm()
      }
    }
  },
  // 设置
  // 昵称
  editNickName() {
    // console.log('clicked');
    var json = this.getLS('pdcid');
    if (json) {
      var user = JSON.parse(json)
      if (user && user.token) {
        this.dialogTitle.string = '输入新昵称';
        this.showDialog();
        this.okFun = () => {
          this.dialogInput.string = this.dialogInput.string.replace(/ /g, '')
          if (this.dialogInput.string == '') return;
          user.nickname = this.dialogInput.string;
          this.setLS('pdcid', JSON.stringify(user))
          this.showTip('更新成功');
          this.loadUserInfo();
          this.hideDialog();
        }
      }
    }
  },
  editFaceImg() {
    var json = this.getLS('pdcid');
    if (json) {
      var user = JSON.parse(json)
      if (user && user.token) {
        if (!user.cid) {
          return this.showTip('请先设置个性ID');
        }
        if (!this.fileInputElement) {
          // this.showTip('click1');
          var formEle = document.createElement("form");
          formEle.name = "fileUploadForm";
          // formEle.method = "post";
          document.getElementById("GameCanvas").appendChild(formEle);
          var aElement = document.createElement("input"); //创建input
          // this.showTip('click2');
          // `<input type="file" name="image" accept="image/*" onchange='handleInputChange'>`
          aElement.name = 'file';
          aElement.accept = 'image/*';
          aElement.id = 'testinputid';
          aElement.type = "file";
          aElement.style.zIndex = '-1';
          aElement.style.position = 'absolute';
          aElement.style.top = 0;
          aElement.style.left = 0;
          aElement.style.maxWidth = '100%';
          aElement.style.maxHeight = '100%';
          aElement.style.border = '0';
          aElement.style.cursor = 'pointer';
          // this.showTip('click3');
          // document.getElementById("GameCanvas").appendChild(aElement);
          formEle.appendChild(aElement);
          // this.showTip('click4');
          this.fileInputElement = aElement;
          // this.showTip('click5');
          this.fileInputElement.addEventListener('change', () => { this.imgChange(user) });
          // this.showTip('click6');
        }
        this.fileInputElement.click();
        // console.log(aElement);
      }
    }
  },
  imgChange(user) {
    var files = this.fileInputElement.files;
    var file = files[0];
    this.imgZip(file, 200, 200, (blob) => {
      // var form = document.forms.namedItem("fileUploadForm");
      // console.log(file);
      var data = new FormData();
      // data.append("file", file);// 文件对象
      data.append("file", blob, file.name);// 文件对象
      // console.log(data);
      this.showLoading();
      this.sendPostRequest('/uploadImg', data, (res) => {
        // console.log(res);
        if (res && res.filename) {
          this.loadingNode.getChildByName("progress").active = false;
          user.face = 'update';
          // 同步数据到redis
          this.client.emit("SaveImg", user, res.filename, () => {
            this.hideLoading();
            // console.log(filename);
            user.face = res.filename;
            user.updateTime = new Date().getTime();
            this.setLS('pdcid', JSON.stringify(user));
            // 重新渲染本地视图
            this.loadUrlImg(res.filename, (newframe) => {
              this.settingNode.getChildByName("box").getChildByName("myinfo").getChildByName("face").getComponent(cc.Sprite).spriteFrame = newframe;
              this.hideLoading();
              this.showTip('更新成功');
            })
          })
        }
      }, true);
    });

    // var reader = new FileReader();
    // reader.onload = () => {
    //   // console.log(reader);
    //   var result = reader.result;
    //   // user.face = result;
    //   // 同步数据到redis
    //   this.showLoading();
    //   user.face = 'update';
    //   // this.client.emit("SendImg", user, result, file.name, (filename) => {
    //   //   // console.log(filename);
    //   //   user.face = filename;
    //   //   user.updateTime = new Date().getTime();
    //   //   this.setLS('pdcid', JSON.stringify(user));
    //   //   // 重新渲染本地视图
    //   //   this.loadUrlImg(filename, (newframe) => {
    //   //     this.settingNode.getChildByName("box").getChildByName("myinfo").getChildByName("face").getComponent(cc.Sprite).spriteFrame = newframe;
    //   //     this.hideLoading();
    //   //     this.showTip('更新成功');
    //   //   })
    //   // })
    // };
    // reader.readAsDataURL(file);
  },
  // 图片压缩
  imgZip(file, width = 200, height = 200, callback) {
    var reader = new FileReader();
    reader.onload = () => {
      // console.log(reader);
      var result = reader.result;
      var img = new Image();
      img.src = result;
      img.onload = function () {
        if (width <= 0 && height <= 0) {
          if (this.width > 560) {
            width = 560;
            height = Math.round((560 / this.width) * this.height);
          } else {
            width = this.width;
            height = this.height;
          }
        }
        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        // 核心JS就这个
        context.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (callback) callback(blob);
        })
      }
    };
    reader.readAsDataURL(file);
  },
  loadBase64Img(base64, callback) {
    var img = document.createElement("img");
    img.id = 'testimgid';
    img.src = base64;
    img.style.zIndex = '-2';
    img.style.position = 'absolute';
    img.style.top = 0;
    img.style.left = 0;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.border = '0';
    document.getElementById("GameCanvas").appendChild(img);
    img.onload = () => {
      var height = img.height;
      // console.log(height);
      // tex
      var texture = new cc.Texture2D();
      texture.initWithElement(img);
      // texture.handleLoadedTexture();
      var newframe = new cc.SpriteFrame(texture);
      // 移除img节点
      document.getElementById("GameCanvas").removeChild(img);
      if (callback) callback(newframe, height);
      // return [newframe, height];
    }
  },
  loadUrlImg(url, callback) {
    if (url.indexOf('http') < 0) {
      url = UploadPath + url;
    }

    cc.loader.load(url, (err, texture) => {
      if (err == null) {
        var newframe = new cc.SpriteFrame(texture);
        if (callback) callback(newframe)
        return;
      }
      console.log(err);
      this.showTip('网络图片加载异常');
    })
  },
  // 个性ID
  editMyId() {
    var json = this.getLS('pdcid');
    if (json) {
      var user = JSON.parse(json)
      if (user && user.token) {
        this.dialogTitle.string = '输入个性ID';
        this.showDialog();
        this.okFun = () => {
          this.dialogInput.string = this.dialogInput.string.replace(/ /g, '')
          if (this.dialogInput.string == '') return;
          this.showLoading();
          this.client.emit("SetMyID", user, this.dialogInput.string, (code) => {
            this.hideLoading();
            if (code == 300) {
              return this.showTip('该ID不可用');
            }
            if (code == 200) {
              user.cid = this.dialogInput.string;
              this.showTip('更新成功');
              this.setLS('pdcid', JSON.stringify(user))
            }
            this.loadUserInfo();
            this.hideDialog();
          })
        }
      }
    }
  },
  sendImg() {
    var json = this.getLS('pdcid');
    if (json) {
      var user = JSON.parse(json)
      if (user && user.token) {
        if (!this.fileInputElement2) {
          var formEle = document.createElement("form");
          formEle.name = "fileUploadForm";
          // formEle.method = "post";
          document.getElementById("GameCanvas").appendChild(formEle);
          var aElement = document.createElement("input"); //创建input
          aElement.name = 'test';
          aElement.accept = 'image/*';
          aElement.id = 'testinputid2';
          aElement.type = "file";
          aElement.style.zIndex = '-1';
          aElement.style.position = 'absolute';
          aElement.style.top = 0;
          aElement.style.left = 0;
          aElement.style.maxWidth = '100%';
          aElement.style.maxHeight = '100%';
          aElement.style.border = '0';
          aElement.style.cursor = 'pointer';
          // document.getElementById("GameCanvas").appendChild(aElement);
          formEle.appendChild(aElement);
          this.fileInputElement2 = aElement;
          this.fileInputElement2.addEventListener('change', () => { this.imgChange2(user) });
        }
        this.fileInputElement2.click();
        // console.log(aElement);
      }
    }
  },
  imgChange2(user) {
    var files = this.fileInputElement2.files;
    var file = files[0];
    this.imgZip(file, 0, 0, (blob) => {
      // var form = document.forms.namedItem("fileUploadForm");
      // console.log(file);
      var data = new FormData();
      // data.append("file", file);// 文件对象
      data.append("file", blob, file.name);// 文件对象
      // console.log(data);
      this.showLoading();
      this.sendPostRequest('/uploadImg', data, (res) => {
        // console.log(res);
        if (res && res.filename) {
          this.loadingNode.getChildByName("progress").active = false;
          var filename = res.filename;
          var json = JSON.stringify({
            "content": filename,
            "user": user,
            "type": "upload_image"
          });
          this.client.emit("SendMsg", this.chatingRoom.roomname, json, (sess) => {
            this.hideLoading();
            if (!sess) {
              this.showTip("您被禁言中");
            }
          })
        }
      }, true);
    });
    // var reader = new FileReader();
    // reader.onload = () => {
    //   // console.log(reader);
    //   var result = reader.result;
    //   // user.face = result;
    //   // 同步数据到redis
    //   this.showLoading();
    //   // console.log(file);
    //   this.client.emit("SendImg", user, result, file.name, (filename) => {
    //     // console.log(filename);
    //     filename = UploadPath + filename;
    //     var json = JSON.stringify({
    //       "content": filename,
    //       "user": user,
    //       "type": "upload_image"
    //     });
    //     this.client.emit("SendMsg", this.chatingRoom.roomname, json, () => {
    //       this.hideLoading();
    //     })
    //   })
    // };
    // reader.readAsDataURL(file);
  },
  changeUploadProgress(txt) {
    let pronode = this.loadingNode.getChildByName("progress");
    pronode.active = true;
    pronode.getComponent(cc.Label).string = txt;
  },
  sendPostRequest(path, data, handler, isFile, extraUrl) {
    var xhr = cc.loader.getXMLHttpRequest();
    if (extraUrl == null) {
      extraUrl = APIurl;
    }
    var requestURL = extraUrl + path;
    console.log("sendPostRequest RequestURL:" + requestURL);
    xhr.open("POST", requestURL, true);
    if (!cc.sys.isNative) {
      if (isFile) {
        xhr.timeout = 5 * 60 * 1000;//5分钟
        // xhr.setRequestHeader("Content-Type", "application/octet-stream");
        xhr.upload.onprogress = (ev) => {
          // console.log(ev);
          // 控制台打印progress { target: XMLHttpRequestUpload, isTrusted: true, lengthComputable: true, //loaded: 15020, total: 15020, eventPhase: 0, bubbles: false, cancelable: false, defaultPrevented: false, //timeStamp: 1445144855459000, originalTarget: XMLHttpRequestUpload }
          if (ev.lengthComputable) {
            var percent = 100 * (ev.loaded / ev.total);
            // console.log(percent);
            this.changeUploadProgress(`${(percent).toFixed(2)}%`);
            // document.getElementById('nei').style.width = precent + '%';
            // document.getElementById('precent').innerHTML = Math.floor(precent) + '%';
          }
        }
      } else {
        xhr.timeout = 5000;
        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
      }
      // if (xhr.upload) {
      //   xhr.overrideMimeType("application/octet-stream");
      //   var ot, oloaded;
      //   function progressFunction(len) {
      //     console.log(len);
      //   }
      //   xhr.upload.onprogress = progressFunction;//【上传进度调用方法实现】
      //   xhr.upload.onloadstart = function () {//上传开始执行方法
      //     ot = new Date().getTime();   //设置上传开始时间
      //     oloaded = 0;//设置上传开始时，以上传的文件大小为0
      //   };
      // }
      var json = this.getLS('pdcid');
      if (json) {
        var user = JSON.parse(json)
        if (user.token) {
          xhr.setRequestHeader("token", user.token);
        }
      }
    }
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4 && (xhr.status >= 200 && xhr.status < 300)) {
        console.log("sendPostRequest http res(" + xhr.responseText.length + "):" + xhr.responseText);
        var httpStatus = xhr.statusText;
        var response = xhr.responseText;
        if (httpStatus == "OK") {
          response = JSON.parse(response);
          if (handler !== null) {
            handler(response);
          }
        }
      }
    };
    if (isFile) {
      xhr.send(data);
    } else {
      xhr.send(JSON.stringify(data));
    }
    // return xhr;
  },
});
