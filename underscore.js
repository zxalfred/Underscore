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
      for (let index = 1; index < length; index++) {
        const source = arguments[index];
        const keys = keysFunc(source);
        const l = keys.length;

        for (let i = 0; i < l; i++) {
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

  // 数组和对象的扩展方法

  // 与 ES5 中 Array.prototype.forEach 类似
  // 第一个参数为数组、类数组或对象
  // 第二个参数为迭代方法，为每个元素执行该方法
  // 该方法能传入三个参数(item, index, array) or (value, key, obj) for object
  // 与 Array.prototype.forEach 方法传参格式一致
  // 第三个可选参数确定迭代方法中的 this 指向
  // 注意: 不要传入 key 为 number 的对象
  // 不能用 return 跳出循环
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);

    if (isArrayLike(obj)) {
      for (let i = 0; i < obj.length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      const keys = _.keys(obj);

      for (let i = 0; i < keys.length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    // 返回 obj 以供链式调用
    return obj;
  };

  // 与 map 类似,遍历集合的每个元素
  // 执行 iteratee 将结果保存在新数组中并返回
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);

    const keys = !isArrayLike(obj) && _.keys(obj);
    const length = (keys || obj).length;
    const results = Array(length);

    for (let index = 0; index < length; index++) {
      const currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }

    return results;
  };

  // 生成 reducing 函数,dir 指定从左到右或相反
  function createReduce(dir) {
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        const currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    }

    return function(obj, iteratee, memo, context) {
      iteratee = optimizeCb(iteratee, memo, context);

      const keys = !isArrayLike(obj) && _.keys(obj);
      const length = (keys || obj).length;
      let index = dir > 0 ? 0 : length - 1;

      // 如果没有指定初始值,则把第一个元素指定为初始值
      if (arguments.length < 3) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // 累加器
  _.reduce = _.foldl = _.inject = createReduce(1);

  // 从尾到首的累加器
  _.reduceRight = _.foldr = createReduce(-1);

  // 寻找集合中第一个满足条件的元素,并返回元素值
  _.find = _.detect = function(obj, predicate, context) {
    let key;
    if (isArrayLike(obj)) {
      key = _.findIndex(obj, predicate, context);
    } else {
      key = _.findKey(obj, predicate, context);
    }
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // 寻找满足条件的元素
  _.filter = _.select = function(obj, predicate, context) {
    const results = [];

    predicate = cb(predicate, context);
    _.each(obj, (value, index, list) => {
      if (predicate(value, index, list)) results.push(value);
    });
  };

  // 寻找不满足条件的元素
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // 集合中的每个元素是否满足条件
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);

    const keys = !isArrayLike(obj) && _.keys(obj);
    const length = (keys || obj).length;

    for (let index = 0; index < length; index++) {
      const currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // 集合中是否有一个元素满足条件
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);

    const keys = !isArrayLike(obj) && _.keys(obj);
    const length = (keys || obj).length;

    for (let index = 0; index < length; index++) {
      const currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // 集合中是否有指定值
  _.contains = _.includes = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);

    if (typeof fromIndex !== 'number' || guard) fromIndex = 0;

    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // 对集合中每个元素调用方法，返回调用的结果
  // method 参数后的参数会当做参数传入 method 方法
  _.invoke = function(obj, method, ...rest) {
    const args = slice.call(rest, 2);
    const isFunc = _.isFunction(method);

    return _.map(obj, (value) => {
      const func = isFunc ? method : value[method];
      return !func ? func : func.apply(value, args);
    });
  };

  // 一个元素都是对象的数组
  // 根据指定的 key 返回一个数组,元素都是指定 key 的 value 值
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // 用是否有指定键值对筛选
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // 寻找第一个有指定键值对的对象
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };
}
