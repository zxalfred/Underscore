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
    return function(...items) {
      const length = items.length;
      // 传入0个和1个参数时
      if (length === 1) return items[0];
      if (length === 0) return {};
      // 枚举第一个参数除外的对象参数
      for (let index = 1; index < length; index++) {
        const source = items[index];
        const keys = keysFunc(source);
        const l = keys.length;

        for (let i = 0; i < l; i++) {
          const key = keys[i];
          if (!undefinedOnly || items[0][key] === void 0) {
            items[0][key] = source[key];
          }
        }
      }
      return items[0];
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

  // 集合的扩展方法

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

  // 寻找最大的元素
  // 如果有 iteratee 参数，则求每个元素经过该函数迭代后的值
  _.max = function(obj, iteratee, context) {
    let result = -Infinity;
    let lastComputed = -Infinity;
    let value;
    let computed;

    if (!iteratee && obj) {
      obj = isArrayLike(obj) ? obj : _.values(obj);

      for (let i = 0; i < obj.length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);

      _.each(obj, (item, index, list) => {
        computed = iteratee(item, index, list);
        // 最后一个判断表示 result 未经修改
        // 即 result 是第一个满足计算结果负无穷大的值
        if (computed > lastComputed || (computed === -Infinity && result === -Infinity)) {
          result = item;
          lastComputed = computed;
        }
      });
    }

    return result;
  };

  // 寻找最小的元素
  _.min = function(obj, iteratee, context) {
    let result = Infinity;
    let lastComputed = Infinity;
    let value;
    let computed;

    if (!iteratee && obj) {
      obj = isArrayLike(obj) ? obj : _.values(obj);

      for (let i = 0; i < obj.length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);

      _.each(obj, (item, index, list) => {
        computed = iteratee(item, index, list);
        if (computed < lastComputed || (computed === Infinity && result === Infinity)) {
          result = value;
          lastComputed = computed;
        }
      });
    }

    return result;
  };

  // 将集合乱序排列
  // 使用 Fisher-Yates shuffle 算法
  // 最优洗牌算法,复杂度 O(n)
  _.shuffle = function(obj) {
    // 如果是对象,则对 vavlue 值进行排序
    const set = isArrayLike(obj) ? obj : _.values(obj);
    const length = set.length;
    const shuffled = Array(length);

    for (let index = 0; index < length; index++) {
      const rand = _.random(0, index);
      // 将当前的元素随机与之前的元素交换位置
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }

    return shuffled;
  };

  // 随机返回一个集合中的元素
  // 如果指定了参数 n 则返回 n 个元素组成的数组
  // 如果参数是对象,则数组由 values 组成
  _.sample = function(obj, n, guard) {
    if (!n || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }

    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // 根据 iteratee 的标准对集合的 value 进行排序
  _.sortBy = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);

    return _.pluck(_.map(obj, (value, index, list) => ({
      value,
      index,
      criteria: iteratee(value, index, list),
    })).sort((left, right) => {
      const a = left.criteria;
      const b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // behavior 为函数参数,作为分类规则
  // _.groupBy, _.indexBy, _.countBy 都是对数组元素进行分类
  const group = function(behavior) {
    return function(obj, iteratee, context) {
      const result = {};
      iteratee = cb(iteratee, context);
      _.each(obj, (value, index) => {
        const key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // 根据特定规则或对象中的元素进行分组
  _.groupBy = group((result, value, key) => {
    if (_.has(result, key)) result[key].push(value);
    else result[key] = [value];
  });

  // 类似 groupBy 但每个组的值是唯一的
  _.indexBy = group((result, value, key) => {
    result[key] = value;
  });

  // 分组计数
  _.countBy = group((result, value, key) => {
    if (_.has(result, key)) result[key]++;
    else result[key] = 1;
  });

  // 将输入转化为数组
  // 类似 Array.from
  _.toArray = function(obj) {
    if (!obj) return [];

    // 如果是数组，返回一个副本
    // 也可以用 concat 或 ES6 数组扩展运算符
    if (_.isArray(obj)) return slice.call(obj);

    // 如果是类数组,则重新构造数组
    // 似乎也可以用 slice 方法
    if (isArrayLike(obj)) return _.map(obj, _.identity);

    // 如果是对象,返回 values 集合
    if (_.isObject(obj)) return _.values(obj);

    return Array.from(obj);
  };

  // 返回集合长度
  _.size = function(obj) {
    if (!obj) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // 将集合中符合条件 predicate 的元素
  // 和不符合条件的元素
  // 分别放入两个数组中
  // 返回一个数组,元素为以上两个数组
  _.partition = function(obj, predicate, context) {
    predicate = cb(predicate, context);

    const pass = [];
    const fail = [];
    _.each(obj, (value, key, rowObj) => {
      (predicate(value, key, rowObj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // 数组的扩展方法

  // 返回数组的第一个元素
  // 若有参数 n 则返回前 n 个元素组成的数组
  _.first = _.head = _.take = function(array, n, guard) {
    if (!array) return void 0;

    if (!n || guard) return array[0];

    return _.initial(array, array.length - n);
  };

  // 传入一个数组
  // 返回剔除最后一个元素之后的数组副本
  // 如果传入参数 n,则剔除最后 n 个元素
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (!n || guard ? 1 : n)));
  };

  // 返回数组最后一个元素
  // 若有参数 n 则返回后 n 个元素组成的数组
  _.last = function(array, n, guard) {
    if (array == null) return void 0;

    if (!n || guard) return array[array.length - 1];

    return _.rest(array, Math.max(0, array.length - n));
  };

  // 传入一个数组
  // 返回剔除第一个元素后的数组副本
  // 如果传入参数 n,则剔除前 n 个元素
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, !n || guard ? 1 : n);
  };

  // 去掉数组中的所用 falsy 值
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // 递归调用数组,将数组展开
  const flatten = function(input, shallow, strict, startIndex) {
    const output = [];
    const length = getLength(input);
    let idx = 0;

    for (let i = startIndex || 0; i < length; i++) {
      let value = input[i];

      if ((isArrayLike(value) && (_.isArray(value))) || _.isArguments(value)) {
        if (!shallow) value = flatten(value, shallow, strict);

        const len = value.length;
        let j = 0;

        output.length += len;
        while (j < len) {
          output[idx++] = value[j++];
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // 将嵌套数组展开
  // 如果 shallow 为 true,则只展开一层
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // 移除数组中的指定元素
  // 返回移除后的数组副本
  _.without = function(array, ...rest) {
    return _.difference(array, rest);
  };

  // 数组去重
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }

    if (iteratee) iteratee = cb(iteratee, context);

    const result = [];

    // 已经出现过的元素,用来过滤重复值
    let seen = [];
    const length = getLength(array);

    for (let i = 0; i < length; i++) {
      const value = array[i];
      const computed = iteratee ? iteratee(value, i, array) : value;

      if (isSorted) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        } else if (!_.contains(result, value)) {
          result.push(value);
        }
      }
    }

    return result;
  };

  // 将多个数组的元素集中到一个数组中
  // 并且去重,返回数组副本
  _.union = function(...arrays) {
    return _.uniq(flatten(arrays, true, true));
  };

  // 寻找几个数组元素的交集
  // 存入新的数组并返回
  _.intersection = function(array, ...rest) {
    const result = [];
    const argsLength = rest.length;

    for (let i = 0; i < getLength(array); i++) {
      const item = array[i];

      if (!_.contains(result, item)) {
        let j = 0;

        for (j; j < argsLength; j++) {
          if (!_.contains(rest[j], item)) break;
        }

        if (j === argsLength) result.push(item);
      }
    }

    return result;
  };

  // 剔除 array 数组中在 others 数组中出现的元素
  _.difference = function(array, ...rest) {
    rest = flatten(rest, true, true);

    return _.filter(array, value => !_.contains(rest, value));
  };

  // 将多个数组中相同位置的元素归类
  _.zip = function(...arrays) {
    return _.unzip(arrays);
  };

  _.unzip = function(array) {
    const length = (array && _.max(array, getLength).length) || 0;
    const result = Array(length);

    for (let index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }

    return result;
  };

  // 将数组转化为对象
  _.object = function(list, values) {
    const result = {};
    const length = getLength(list);

    for (let i = 0; i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // 寻找 index 的辅助函数
  function createPredicateIndexFinder(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);

      const length = getLength(array);
      let index = dir > 0 ? 0 : length - 1;

      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) { return index; }
      }

      return -1;
    };
  }

  // 从前往后找
  _.findIndex = createPredicateIndexFinder(1);

  // 从后往前找
  _.findLastIndex = createPredicateIndexFinder(-1);

  // 将一个元素插入已排序的数组
  // 返回插入位置的下标
  // 二分法
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);

    const value = iteratee(obj);
    let low = 0;
    let high = getLength(array);

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid] < value)) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  };

  // 生成 indexOf 和 lastIndexOf 函数的工具函数
  function createIndexFinder(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      let i = 0;
      let length = getLength(array);

      if (typeof idx === 'number') {
        if (dir > 0) {
          i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
          length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        // 使用二分法
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }

      // 当查找的元素为 NaN
      if (_.isNaN(item)) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return array[idx] === item ? idx : -1;
      }

      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }

      return -1;
    };
  }

  // 寻找元素位置
  // 第三个参数为 true 指定数组已经排序
  // 第三个参数为数字指定查找位置
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);

  // 从末尾寻找元素位置
  // 第三个参数指定从倒数第几位查找
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // 返回一定范围内的数组成的数组
  _.range = function(start, stop, step) {
    if (!stop) {
      stop = start || 0;
      start = 0;
    }

    step = step || 1;

    const length = Math.max(Math.ceil((stop - start) / step), 0);

    const range = Array(length);

    for (let idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // 判断函数是否为 new 调用
  const executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    // 非 new 调用 _.bind 返回的方法
    // callingContext 不是 boundFunc 的一个实例
    if (!(callingContext instanceof boundFunc)) {
      return sourceFunc.apply(context, args);
    }

    const self = baseCreate(sourceFunc.prototype);
    const result = sourceFunc.apply(self, args);

    if (_.isObject(result)) return result;

    return self;
  };

  // ES 5 bind 方法的扩展
  // 可选的 arguments 参数会被当做 func 的参数传入
  // func 在调用时,优先用 arguments 参数, 然后使用 _.bind 返回方法所传入的参数
  _.bind = function(func, context, ...rest) {
    // 如果支持 ES 5 bind 则使用
    if (nativeBind && func.bind === nativeBind) {
      return nativeBind.apply(func, [context, ...rest]);
    }

    if (!_.isFunction(func)) {
      throw new TypeError('Bind nust be called on a function');
    }

    const bound = function(...args) {
      return executeBound(func, bound, context, this, rest.concat(args));
    };

    return bound;
  };

  _.partial = function(func, ...boundArgs) {
    const bound = function(...fillArgs) {
      let position = 0;
      const length = boundArgs.length;
      const args = Array(length);
      for (let i = 0; i < length; i++) {
        args[i] = boundArgs[i] === _ ? fillArgs[position++] : boundArgs[i];
      }

      while (position < fillArgs.length) {
        args.push(fillArgs[position++]);
      }

      return executeBound(func, bound, this, this, args);
    };

    return bound;
  };

  // 将 obj 中的指定方法的 this 指向 obj
  _.bindAll = function(obj, ...methodNames) {
    const length = methodNames.length;

    if (methodNames < 1) {
      throw new Error('bindAll must be passed function names');
    }

    for (let i = 0; i < length; i++) {
      const key = methodNames[i];
      obj[key] = _.bind(obj[key], obj);
    }

    return obj;
  };
}
