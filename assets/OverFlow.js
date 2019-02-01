cc.Class({
  extends: cc.Component,
  properties: {
  },
  onLoad() {
    var cont = this.node.getChildByName('box').getChildByName('cont');
    if (cont.height > this.node.getChildByName('box').height) {
      this.node.getChildByName('plus').active = true;
    } else {
      this.node.getChildByName('plus').active = false;
    }
  },
  update(dt) { },
});
