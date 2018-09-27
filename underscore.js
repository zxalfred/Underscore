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

  // 将局部变量 _ 赋值给全局对象的 _ 属性
  // 即浏览器环境中的 window._ = _ 和 node 中的 exports._ = _
  // 同事在服务端兼容老的 require() API
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = _;
      exports._ = _;
    } else {
      root._ = _;
    }
  }

  // 内部函数，用于返回传入回调函数的高效版本
  // 用于在 Underscore 的方法中重复调用
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

    // 使用下面的代码就完全可以实现这个函数的功能
    // 不这样做是因为 call 的效率远高于 apply
    return function(...args) {
      return func.apply(context, args);
    };
  };

  // 生成可应用于集合中每个元素的回调，返回所需要的结果
  // 标识符、任意回调、属性匹配器或属性访问器
  const cb = function(value, context, argCount) {
    if (!value) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
  };

  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };
  // 给以下三个方法用到的内部函数:
  // _.extend = createAssigner(_.allKeys);
  // _.extendOwn = _.assign = createAssigner(_.keys);
  // _.defaults = createAssigner(_.allKeys, true);
  const createAssigner = function(keysFunc, undefinedOnly) {
    return function(obj) {
      const length = arguments.length;
      // 传入 0~1 个参数时
      if (length < 2 || obj == null) return obj;

      // 枚举第一个参数除外的对象参数
      for (let index = 1; index < length; index += 1) {
        const source = arguments[index];
        const keys = keysFunc(source);
        const l = keys.length;

        for (let i = 0; i < l; i += 1) {
          const key = keys[i];
          if (!undefinedOnly || obj[key] === void 0) {
            obj[key] = source[key];
          }
        }
      }
      return obj;
    };
  };

  // 新建一个继承原对象的对象
  // 供 _.create 使用
  const baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};

    // 如果支持 ES5 Object.create
    if (nativeCreate) return nativeCreate(prototype);

    Ctor.prototype = prototype;
    const result = new Ctor();
    Ctor.prototype = null;
    return result;
  };

  // 闭包,获取对象中的指定 key
  const property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // 此为 JS 中能精确表达的最大数字
  const MAX_ARRAY_INDEX = (2 ** 53) - 1;

  // 获取 array 以及 arrayLike 元素的 length 属性值
  const getLength = property('length');

  // 判断是否为 ArrayLike Object
  // 个人感觉有点粗糙，只判断了 length 属性值是否符合要求
  const isArrayLike = function(collection) {
    const length = getLength(collection);
    return typeof length === 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };
}
