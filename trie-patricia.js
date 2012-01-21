/*
 * $Id: trie-patricia.js,v 0.2 2012/01/21 10:18:03 dankogai Exp dankogai $
 *
 *  Licensed under the MIT license.
 *  http://www.opensource.org/licenses/mit-license.php
 *
 *  References:
 *      http://en.wikipedia.org/wiki/Radix_trie
 */

(function(global) {

if (! Object.create || 'valueOf' in Object.create(null))
    throw Error('ES5 required');

var preflen = function(a, b) {
    var n = 0;
    for (; n < a.length && n < b.length; n++) {
        if (a.substr(n, 1) !== b.substr(n, 1)) return n;
    }
    return n;
};

var TP = function(o) {
    if (!(this instanceof TP)) return new TP(o);
    (function(self, o) {
        if (o !== Object(o)) return self;
        else if (Array.isArray(o)) Object.keys(o).forEach(function(k) {
            self.set(o[k], 1);
        });
        else Object.keys(o).forEach(function(k) {
            self.set(k, o[k]);
        });
        return self;
    })(this, o);
};

(function(methods) {
    for (var p in methods) TP.prototype[p] = methods[p];
    var slice = Array.prototype.slice;
    for (var p in methods) TP[p] = (function(method) {
        return function(t) {
            return method.apply(t, slice.call(arguments, 1));
        };
    })(methods[p]);
})({
set: function(key, val) {
    var cc = key.charAt(0),
        suf = key.substr(1);
    if (!cc || !this[cc]) {
        this[cc] = [suf, val];
    } else if (this[cc] instanceof TP) {
        this[cc].set(suf, val);
    } else {
        var pk = this[cc][0], pv = this[cc][1],
            pl = preflen(pk, suf), kid = new TP;
        if (pl <= 1) {
            kid.set(suf, val).set(pk, pv);
            this[cc] = kid;
        } else {
            if (pv instanceof TP) {
                pv.set(suf.substr(pl), val);
            } else {
                kid.set(pk.substr(pl), pv).set(suf.substr(pl), val);
                this[cc] = [suf.substr(0, pl), kid];
            }
        }
    }
    return this;
},
get: function(key) {
    var cc = key.charAt(0);
    if (!this[cc]) return;
    if (!cc) return this[cc][1];
    var suf = key.substr(1);
    if (this[cc] instanceof TP) return this[cc].get(suf);
    var pk = this[cc][0], pv = this[cc][1],
        pl = preflen(pk, suf);
    if (pv instanceof TP) {
        if (pk === suf.substr(0, pl)) return pv.get(suf.substr(pl));
    } else {
        if (pk === suf) return pv;
    }
    return;
},
has: function(key) {
    var cc = key.charAt(0);
    if (!this[cc]) return false;
    if (!cc) return 1 in this[cc];
    var suf = key.substr(1);
    if (this[cc] instanceof TP) return this[cc].has(suf);
    var pk = this[cc][0], pv = this[cc][1],
        pl = preflen(pk, suf);
    if (pv instanceof TP) {
        if (pk === suf.substr(0, pl)) return pv.has(suf.substr(pl));
    } else {
        if (pk === suf) return true;
    }
    return false;
},
del: function(key) {
    var cc = key.charAt(0);
    if (!this[cc]) return true;
    if (!cc) return delete this[cc];
    var suf = key.substr(1);
    if (this[cc] instanceof TP) return this[cc].del(suf);
    var pk = this[cc][0], pv = this[cc][1],
        pl = preflen(pk, suf);
    if (pv instanceof TP) {
        if (pk === suf.substr(0, pl)) {
             var ret = pv.del(suf.substr(pl));
             return Object.keys(pv).length === 0 ? delete this[cc] : ret;
        }
    } else {
        if (pk === suf) return delete this[cc];
    }
    return Object.keys(this[cc]).length === 0 ? delete this[cc] : true;
},
each: function(callback, prefix) {
    prefix = prefix || '';
    var self = this;
    Object.keys(this).sort().forEach(function(cc) {
        if (self[cc] instanceof TP) return self[cc].each(callback, prefix + cc);
        var pk = self[cc][0], pv = self[cc][1];
        if (pv instanceof TP) return pv.each(callback, prefix + cc + pk);
        return callback(prefix + cc + pk, self[cc][1]);
    });
},
keys: function() {
    var ret = [];
    this.each(function(k, v) { ret.push(k) });
    return ret;
},
values: function() {
    var ret = [];
    this.each(function(k, v) { ret.push(v) });
    return ret;
},
asJSON: function(replacer, space) {
    return JSON.stringify(this, replacer, space);
},
toObject: function() {
    var ret = Object.create(null);
    this.each(function(k, v) { ret[k] = v });
    return ret;
},
toRegExp: function(flag) {
    return new RegExp(this.__RegExp(), flag);
}
});

var quotemeta = function(str) {
    return str.replace(/[\S\s]/g, function(m) {
        var cc = m.charCodeAt(0);
        return cc < 128
            ? m.match(/^\w$/) ? m : '\\x' + cc.toString(16)
            : m;
    });
};

TP.prototype.__RegExp = function() {
    var self = this;
    var alt = [], ccs = [], q = false;
    Object.keys(this).sort().forEach(function(cc) {
        if (cc) {
            var qc = quotemeta(cc);
            if (self[cc] instanceof TP) {
                alt.push(qc + self[cc].__RegExp());
            } else {
                var qk = quotemeta(self[cc][0] || ''),
                    pv = self[cc][1];
                if (pv instanceof TP) alt.push(qc + qk + pv.__RegExp());
                else (qk.length ? alt : ccs).push(qc + qk);
            }
        }else {
            q = true;
        }
    });
    if (ccs.length) alt.push(
        ccs.length === 1 ? ccs[0] : '[' + ccs.join('') + ']'
    );
    var ret = '(?:' + alt.sort().join('|') + ')';
    if (q) ret = alt.length ? ret + '?' : '(?:' + ret + ')?';
    return ret;
};

global.Trie = global.Trie || function() {};
global.Trie.Patricia = TP;
})(this);
