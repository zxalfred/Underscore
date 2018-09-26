{
  // 基本配置
  // 建立 root 对象,浏览器中为 window,服务端为 exports
  const root = this;

  // 保存环境中原有的 _ 值
  const previousUnderscore = root._;

  // 缓存变量，便于压缩
  // 同时减少在原型链中查找测次数，提高效率
  const ArrayProto = Array.prototype;
  const ObjProto = Object.prototype;
  const FuncProto = Function.prototype;

  const { push, slice } = ArrayProto;
  const { toString, hasOwnProperty } = ObjProto;

  // ES5 原生方法，如果支持则优先使用
  const { isArray: nativeIsArray } = Array;
  const { keys: nativeKeys } = Object;
  const { bind: nativeBind } = FuncProto;
  const { create: nativeCreate } = Object;

  // 用于继承的桥接函数
  const Ctor = function() {};

  const _ = function(obj) {
    // 如果 obj 已经是 _ 的实例,则直接返回
    if (obj instanceof _) {
      return obj;
    }

    // 如果函数为非 new 调用
    // 则调用 new 运算符,返回实例化的对象
    if (!(this instanceof _)) {
      return new _(obj);
    }
    this._wrapped = obj;
  };

  // 在 Underscore 方法中重复调用传入的回调函数
  const optimizeCb = function(func, context, argCount) {
    if (context === void 0) {
      return func;
    }

    switch (argCount === null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }

    return function(...args) {
      return func.apply(context, args);
    };
  };
}
