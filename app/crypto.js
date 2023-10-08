var CryptoJS = CryptoJS || function (u, p) {
    var d = {},
        l = d.lib = {},
        s = function () {},
        t = l.Base = {
            extend: function (a) {
                s.prototype = this;
                var c = new s;
                a && c.mixIn(a);
                c.hasOwnProperty("init") || (c.init = function () {
                    c.$super.init.apply(this, arguments)
                });
                c.init.prototype = c;
                c.$super = this;
                return c
            },
            create: function () {
                var a = this.extend();
                a.init.apply(a, arguments);
                return a
            },
            init: function () {},
            mixIn: function (a) {
                for (var c in a) a.hasOwnProperty(c) && (this[c] = a[c]);
                a.hasOwnProperty("toString") && (this.toString = a.toString)
            },
            clone: function () {
                return this.init.prototype.extend(this)
            }
        },
        r = l.WordArray = t.extend({
            init: function (a, c) {
                a = this.words = a || [];
                this.sigBytes = c != p ? c : 4 * a.length
            },
            toString: function (a) {
                return (a || v).stringify(this)
            },
            concat: function (a) {
                var c = this.words,
                    e = a.words,
                    j = this.sigBytes;
                a = a.sigBytes;
                this.clamp();
                if (j % 4)
                    for (var k = 0; k < a; k++) c[j + k >>> 2] |= (e[k >>> 2] >>> 24 - 8 * (k % 4) & 255) << 24 - 8 * ((j + k) % 4);
                else if (65535 < e.length)
                    for (k = 0; k < a; k += 4) c[j + k >>> 2] = e[k >>> 2];
                else c.push.apply(c, e);
                this.sigBytes += a;
                return this
            },
            clamp: function () {
                var a = this.words,
                    c = this.sigBytes;
                a[c >>> 2] &= 4294967295 <<
                    32 - 8 * (c % 4);
                a.length = u.ceil(c / 4)
            },
            clone: function () {
                var a = t.clone.call(this);
                a.words = this.words.slice(0);
                return a
            },
            random: function (a) {
                for (var c = [], e = 0; e < a; e += 4) c.push(4294967296 * u.random() | 0);
                return new r.init(c, a)
            }
        }),
        w = d.enc = {},
        v = w.Hex = {
            stringify: function (a) {
                var c = a.words;
                a = a.sigBytes;
                for (var e = [], j = 0; j < a; j++) {
                    var k = c[j >>> 2] >>> 24 - 8 * (j % 4) & 255;
                    e.push((k >>> 4).toString(16));
                    e.push((k & 15).toString(16))
                }
                return e.join("")
            },
            parse: function (a) {
                for (var c = a.length, e = [], j = 0; j < c; j += 2) e[j >>> 3] |= parseInt(a.substr(j,
                    2), 16) << 24 - 4 * (j % 8);
                return new r.init(e, c / 2)
            }
        },
        b = w.Latin1 = {
            stringify: function (a) {
                var c = a.words;
                a = a.sigBytes;
                for (var e = [], j = 0; j < a; j++) e.push(String.fromCharCode(c[j >>> 2] >>> 24 - 8 * (j % 4) & 255));
                return e.join("")
            },
            parse: function (a) {
                for (var c = a.length, e = [], j = 0; j < c; j++) e[j >>> 2] |= (a.charCodeAt(j) & 255) << 24 - 8 * (j % 4);
                return new r.init(e, c)
            }
        },
        x = w.Utf8 = {
            stringify: function (a) {
                try {
                    return decodeURIComponent(escape(b.stringify(a)))
                } catch (c) {
                    throw Error("Malformed UTF-8 data");
                }
            },
            parse: function (a) {
                return b.parse(unescape(encodeURIComponent(a)))
            }
        },
        q = l.BufferedBlockAlgorithm = t.extend({
            reset: function () {
                this._data = new r.init;
                this._nDataBytes = 0
            },
            _append: function (a) {
                "string" == typeof a && (a = x.parse(a));
                this._data.concat(a);
                this._nDataBytes += a.sigBytes
            },
            _process: function (a) {
                var c = this._data,
                    e = c.words,
                    j = c.sigBytes,
                    k = this.blockSize,
                    b = j / (4 * k),
                    b = a ? u.ceil(b) : u.max((b | 0) - this._minBufferSize, 0);
                a = b * k;
                j = u.min(4 * a, j);
                if (a) {
                    for (var q = 0; q < a; q += k) this._doProcessBlock(e, q);
                    q = e.splice(0, a);
                    c.sigBytes -= j
                }
                return new r.init(q, j)
            },
            clone: function () {
                var a = t.clone.call(this);
                a._data = this._data.clone();
                return a
            },
            _minBufferSize: 0
        });
    l.Hasher = q.extend({
        cfg: t.extend(),
        init: function (a) {
            this.cfg = this.cfg.extend(a);
            this.reset()
        },
        reset: function () {
            q.reset.call(this);
            this._doReset()
        },
        update: function (a) {
            this._append(a);
            this._process();
            return this
        },
        finalize: function (a) {
            a && this._append(a);
            return this._doFinalize()
        },
        blockSize: 16,
        _createHelper: function (a) {
            return function (b, e) {
                return (new a.init(e)).finalize(b)
            }
        },
        _createHmacHelper: function (a) {
            return function (b, e) {
                return (new n.HMAC.init(a,
                    e)).finalize(b)
            }
        }
    });
    var n = d.algo = {};
    return d
}(Math);
(function () {
    var u = CryptoJS,
        p = u.lib.WordArray;
    u.enc.Base64 = {
        stringify: function (d) {
            var l = d.words,
                p = d.sigBytes,
                t = this._map;
            d.clamp();
            d = [];
            for (var r = 0; r < p; r += 3)
                for (var w = (l[r >>> 2] >>> 24 - 8 * (r % 4) & 255) << 16 | (l[r + 1 >>> 2] >>> 24 - 8 * ((r + 1) % 4) & 255) << 8 | l[r + 2 >>> 2] >>> 24 - 8 * ((r + 2) % 4) & 255, v = 0; 4 > v && r + 0.75 * v < p; v++) d.push(t.charAt(w >>> 6 * (3 - v) & 63));
            if (l = t.charAt(64))
                for (; d.length % 4;) d.push(l);
            return d.join("")
        },
        parse: function (d) {
            var l = d.length,
                s = this._map,
                t = s.charAt(64);
            t && (t = d.indexOf(t), -1 != t && (l = t));
            for (var t = [], r = 0, w = 0; w <
                l; w++)
                if (w % 4) {
                    var v = s.indexOf(d.charAt(w - 1)) << 2 * (w % 4),
                        b = s.indexOf(d.charAt(w)) >>> 6 - 2 * (w % 4);
                    t[r >>> 2] |= (v | b) << 24 - 8 * (r % 4);
                    r++
                } return p.create(t, r)
        },
        _map: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
    }
})();
(function (u) {
    function p(b, n, a, c, e, j, k) {
        b = b + (n & a | ~n & c) + e + k;
        return (b << j | b >>> 32 - j) + n
    }

    function d(b, n, a, c, e, j, k) {
        b = b + (n & c | a & ~c) + e + k;
        return (b << j | b >>> 32 - j) + n
    }

    function l(b, n, a, c, e, j, k) {
        b = b + (n ^ a ^ c) + e + k;
        return (b << j | b >>> 32 - j) + n
    }

    function s(b, n, a, c, e, j, k) {
        b = b + (a ^ (n | ~c)) + e + k;
        return (b << j | b >>> 32 - j) + n
    }
    for (var t = CryptoJS, r = t.lib, w = r.WordArray, v = r.Hasher, r = t.algo, b = [], x = 0; 64 > x; x++) b[x] = 4294967296 * u.abs(u.sin(x + 1)) | 0;
    r = r.MD5 = v.extend({
        _doReset: function () {
            this._hash = new w.init([1732584193, 4023233417, 2562383102, 271733878])
        },
        _doProcessBlock: function (q, n) {
            for (var a = 0; 16 > a; a++) {
                var c = n + a,
                    e = q[c];
                q[c] = (e << 8 | e >>> 24) & 16711935 | (e << 24 | e >>> 8) & 4278255360
            }
            var a = this._hash.words,
                c = q[n + 0],
                e = q[n + 1],
                j = q[n + 2],
                k = q[n + 3],
                z = q[n + 4],
                r = q[n + 5],
                t = q[n + 6],
                w = q[n + 7],
                v = q[n + 8],
                A = q[n + 9],
                B = q[n + 10],
                C = q[n + 11],
                u = q[n + 12],
                D = q[n + 13],
                E = q[n + 14],
                x = q[n + 15],
                f = a[0],
                m = a[1],
                g = a[2],
                h = a[3],
                f = p(f, m, g, h, c, 7, b[0]),
                h = p(h, f, m, g, e, 12, b[1]),
                g = p(g, h, f, m, j, 17, b[2]),
                m = p(m, g, h, f, k, 22, b[3]),
                f = p(f, m, g, h, z, 7, b[4]),
                h = p(h, f, m, g, r, 12, b[5]),
                g = p(g, h, f, m, t, 17, b[6]),
                m = p(m, g, h, f, w, 22, b[7]),
                f = p(f, m, g, h, v, 7, b[8]),
                h = p(h, f, m, g, A, 12, b[9]),
                g = p(g, h, f, m, B, 17, b[10]),
                m = p(m, g, h, f, C, 22, b[11]),
                f = p(f, m, g, h, u, 7, b[12]),
                h = p(h, f, m, g, D, 12, b[13]),
                g = p(g, h, f, m, E, 17, b[14]),
                m = p(m, g, h, f, x, 22, b[15]),
                f = d(f, m, g, h, e, 5, b[16]),
                h = d(h, f, m, g, t, 9, b[17]),
                g = d(g, h, f, m, C, 14, b[18]),
                m = d(m, g, h, f, c, 20, b[19]),
                f = d(f, m, g, h, r, 5, b[20]),
                h = d(h, f, m, g, B, 9, b[21]),
                g = d(g, h, f, m, x, 14, b[22]),
                m = d(m, g, h, f, z, 20, b[23]),
                f = d(f, m, g, h, A, 5, b[24]),
                h = d(h, f, m, g, E, 9, b[25]),
                g = d(g, h, f, m, k, 14, b[26]),
                m = d(m, g, h, f, v, 20, b[27]),
                f = d(f, m, g, h, D, 5, b[28]),
                h = d(h, f,
                    m, g, j, 9, b[29]),
                g = d(g, h, f, m, w, 14, b[30]),
                m = d(m, g, h, f, u, 20, b[31]),
                f = l(f, m, g, h, r, 4, b[32]),
                h = l(h, f, m, g, v, 11, b[33]),
                g = l(g, h, f, m, C, 16, b[34]),
                m = l(m, g, h, f, E, 23, b[35]),
                f = l(f, m, g, h, e, 4, b[36]),
                h = l(h, f, m, g, z, 11, b[37]),
                g = l(g, h, f, m, w, 16, b[38]),
                m = l(m, g, h, f, B, 23, b[39]),
                f = l(f, m, g, h, D, 4, b[40]),
                h = l(h, f, m, g, c, 11, b[41]),
                g = l(g, h, f, m, k, 16, b[42]),
                m = l(m, g, h, f, t, 23, b[43]),
                f = l(f, m, g, h, A, 4, b[44]),
                h = l(h, f, m, g, u, 11, b[45]),
                g = l(g, h, f, m, x, 16, b[46]),
                m = l(m, g, h, f, j, 23, b[47]),
                f = s(f, m, g, h, c, 6, b[48]),
                h = s(h, f, m, g, w, 10, b[49]),
                g = s(g, h, f, m,
                    E, 15, b[50]),
                m = s(m, g, h, f, r, 21, b[51]),
                f = s(f, m, g, h, u, 6, b[52]),
                h = s(h, f, m, g, k, 10, b[53]),
                g = s(g, h, f, m, B, 15, b[54]),
                m = s(m, g, h, f, e, 21, b[55]),
                f = s(f, m, g, h, v, 6, b[56]),
                h = s(h, f, m, g, x, 10, b[57]),
                g = s(g, h, f, m, t, 15, b[58]),
                m = s(m, g, h, f, D, 21, b[59]),
                f = s(f, m, g, h, z, 6, b[60]),
                h = s(h, f, m, g, C, 10, b[61]),
                g = s(g, h, f, m, j, 15, b[62]),
                m = s(m, g, h, f, A, 21, b[63]);
            a[0] = a[0] + f | 0;
            a[1] = a[1] + m | 0;
            a[2] = a[2] + g | 0;
            a[3] = a[3] + h | 0
        },
        _doFinalize: function () {
            var b = this._data,
                n = b.words,
                a = 8 * this._nDataBytes,
                c = 8 * b.sigBytes;
            n[c >>> 5] |= 128 << 24 - c % 32;
            var e = u.floor(a /
                4294967296);
            n[(c + 64 >>> 9 << 4) + 15] = (e << 8 | e >>> 24) & 16711935 | (e << 24 | e >>> 8) & 4278255360;
            n[(c + 64 >>> 9 << 4) + 14] = (a << 8 | a >>> 24) & 16711935 | (a << 24 | a >>> 8) & 4278255360;
            b.sigBytes = 4 * (n.length + 1);
            this._process();
            b = this._hash;
            n = b.words;
            for (a = 0; 4 > a; a++) c = n[a], n[a] = (c << 8 | c >>> 24) & 16711935 | (c << 24 | c >>> 8) & 4278255360;
            return b
        },
        clone: function () {
            var b = v.clone.call(this);
            b._hash = this._hash.clone();
            return b
        }
    });
    t.MD5 = v._createHelper(r);
    t.HmacMD5 = v._createHmacHelper(r)
})(Math);
(function () {
    var u = CryptoJS,
        p = u.lib,
        d = p.Base,
        l = p.WordArray,
        p = u.algo,
        s = p.EvpKDF = d.extend({
            cfg: d.extend({
                keySize: 4,
                hasher: p.MD5,
                iterations: 1
            }),
            init: function (d) {
                this.cfg = this.cfg.extend(d)
            },
            compute: function (d, r) {
                for (var p = this.cfg, s = p.hasher.create(), b = l.create(), u = b.words, q = p.keySize, p = p.iterations; u.length < q;) {
                    n && s.update(n);
                    var n = s.update(d).finalize(r);
                    s.reset();
                    for (var a = 1; a < p; a++) n = s.finalize(n), s.reset();
                    b.concat(n)
                }
                b.sigBytes = 4 * q;
                return b
            }
        });
    u.EvpKDF = function (d, l, p) {
        return s.create(p).compute(d,
            l)
    }
})();
CryptoJS.lib.Cipher || function (u) {
    var p = CryptoJS,
        d = p.lib,
        l = d.Base,
        s = d.WordArray,
        t = d.BufferedBlockAlgorithm,
        r = p.enc.Base64,
        w = p.algo.EvpKDF,
        v = d.Cipher = t.extend({
            cfg: l.extend(),
            createEncryptor: function (e, a) {
                return this.create(this._ENC_XFORM_MODE, e, a)
            },
            createDecryptor: function (e, a) {
                return this.create(this._DEC_XFORM_MODE, e, a)
            },
            init: function (e, a, b) {
                this.cfg = this.cfg.extend(b);
                this._xformMode = e;
                this._key = a;
                this.reset()
            },
            reset: function () {
                t.reset.call(this);
                this._doReset()
            },
            process: function (e) {
                this._append(e);
                return this._process()
            },
            finalize: function (e) {
                e && this._append(e);
                return this._doFinalize()
            },
            keySize: 4,
            ivSize: 4,
            _ENC_XFORM_MODE: 1,
            _DEC_XFORM_MODE: 2,
            _createHelper: function (e) {
                return {
                    encrypt: function (b, k, d) {
                        return ("string" == typeof k ? c : a).encrypt(e, b, k, d)
                    },
                    decrypt: function (b, k, d) {
                        return ("string" == typeof k ? c : a).decrypt(e, b, k, d)
                    }
                }
            }
        });
    d.StreamCipher = v.extend({
        _doFinalize: function () {
            return this._process(!0)
        },
        blockSize: 1
    });
    var b = p.mode = {},
        x = function (e, a, b) {
            var c = this._iv;
            c ? this._iv = u : c = this._prevBlock;
            for (var d = 0; d < b; d++) e[a + d] ^=
                c[d]
        },
        q = (d.BlockCipherMode = l.extend({
            createEncryptor: function (e, a) {
                return this.Encryptor.create(e, a)
            },
            createDecryptor: function (e, a) {
                return this.Decryptor.create(e, a)
            },
            init: function (e, a) {
                this._cipher = e;
                this._iv = a
            }
        })).extend();
    q.Encryptor = q.extend({
        processBlock: function (e, a) {
            var b = this._cipher,
                c = b.blockSize;
            x.call(this, e, a, c);
            b.encryptBlock(e, a);
            this._prevBlock = e.slice(a, a + c)
        }
    });
    q.Decryptor = q.extend({
        processBlock: function (e, a) {
            var b = this._cipher,
                c = b.blockSize,
                d = e.slice(a, a + c);
            b.decryptBlock(e, a);
            x.call(this,
                e, a, c);
            this._prevBlock = d
        }
    });
    b = b.CBC = q;
    q = (p.pad = {}).Pkcs7 = {
        pad: function (a, b) {
            for (var c = 4 * b, c = c - a.sigBytes % c, d = c << 24 | c << 16 | c << 8 | c, l = [], n = 0; n < c; n += 4) l.push(d);
            c = s.create(l, c);
            a.concat(c)
        },
        unpad: function (a) {
            a.sigBytes -= a.words[a.sigBytes - 1 >>> 2] & 255
        }
    };
    d.BlockCipher = v.extend({
        cfg: v.cfg.extend({
            mode: b,
            padding: q
        }),
        reset: function () {
            v.reset.call(this);
            var a = this.cfg,
                b = a.iv,
                a = a.mode;
            if (this._xformMode == this._ENC_XFORM_MODE) var c = a.createEncryptor;
            else c = a.createDecryptor, this._minBufferSize = 1;
            this._mode = c.call(a,
                this, b && b.words)
        },
        _doProcessBlock: function (a, b) {
            this._mode.processBlock(a, b)
        },
        _doFinalize: function () {
            var a = this.cfg.padding;
            if (this._xformMode == this._ENC_XFORM_MODE) {
                a.pad(this._data, this.blockSize);
                var b = this._process(!0)
            } else b = this._process(!0), a.unpad(b);
            return b
        },
        blockSize: 4
    });
    var n = d.CipherParams = l.extend({
            init: function (a) {
                this.mixIn(a)
            },
            toString: function (a) {
                return (a || this.formatter).stringify(this)
            }
        }),
        b = (p.format = {}).OpenSSL = {
            stringify: function (a) {
                var b = a.ciphertext;
                a = a.salt;
                return (a ? s.create([1398893684,
                    1701076831
                ]).concat(a).concat(b) : b).toString(r)
            },
            parse: function (a) {
                a = r.parse(a);
                var b = a.words;
                if (1398893684 == b[0] && 1701076831 == b[1]) {
                    var c = s.create(b.slice(2, 4));
                    b.splice(0, 4);
                    a.sigBytes -= 16
                }
                return n.create({
                    ciphertext: a,
                    salt: c
                })
            }
        },
        a = d.SerializableCipher = l.extend({
            cfg: l.extend({
                format: b
            }),
            encrypt: function (a, b, c, d) {
                d = this.cfg.extend(d);
                var l = a.createEncryptor(c, d);
                b = l.finalize(b);
                l = l.cfg;
                return n.create({
                    ciphertext: b,
                    key: c,
                    iv: l.iv,
                    algorithm: a,
                    mode: l.mode,
                    padding: l.padding,
                    blockSize: a.blockSize,
                    formatter: d.format
                })
            },
            decrypt: function (a, b, c, d) {
                d = this.cfg.extend(d);
                b = this._parse(b, d.format);
                return a.createDecryptor(c, d).finalize(b.ciphertext)
            },
            _parse: function (a, b) {
                return "string" == typeof a ? b.parse(a, this) : a
            }
        }),
        p = (p.kdf = {}).OpenSSL = {
            execute: function (a, b, c, d) {
                d || (d = s.random(8));
                a = w.create({
                    keySize: b + c
                }).compute(a, d);
                c = s.create(a.words.slice(b), 4 * c);
                a.sigBytes = 4 * b;
                return n.create({
                    key: a,
                    iv: c,
                    salt: d
                })
            }
        },
        c = d.PasswordBasedCipher = a.extend({
            cfg: a.cfg.extend({
                kdf: p
            }),
            encrypt: function (b, c, d, l) {
                l = this.cfg.extend(l);
                d = l.kdf.execute(d,
                    b.keySize, b.ivSize);
                l.iv = d.iv;
                b = a.encrypt.call(this, b, c, d.key, l);
                b.mixIn(d);
                return b
            },
            decrypt: function (b, c, d, l) {
                l = this.cfg.extend(l);
                c = this._parse(c, l.format);
                d = l.kdf.execute(d, b.keySize, b.ivSize, c.salt);
                l.iv = d.iv;
                return a.decrypt.call(this, b, c, d.key, l)
            }
        })
}();
(function () {
    for (var u = CryptoJS, p = u.lib.BlockCipher, d = u.algo, l = [], s = [], t = [], r = [], w = [], v = [], b = [], x = [], q = [], n = [], a = [], c = 0; 256 > c; c++) a[c] = 128 > c ? c << 1 : c << 1 ^ 283;
    for (var e = 0, j = 0, c = 0; 256 > c; c++) {
        var k = j ^ j << 1 ^ j << 2 ^ j << 3 ^ j << 4,
            k = k >>> 8 ^ k & 255 ^ 99;
        l[e] = k;
        s[k] = e;
        var z = a[e],
            F = a[z],
            G = a[F],
            y = 257 * a[k] ^ 16843008 * k;
        t[e] = y << 24 | y >>> 8;
        r[e] = y << 16 | y >>> 16;
        w[e] = y << 8 | y >>> 24;
        v[e] = y;
        y = 16843009 * G ^ 65537 * F ^ 257 * z ^ 16843008 * e;
        b[k] = y << 24 | y >>> 8;
        x[k] = y << 16 | y >>> 16;
        q[k] = y << 8 | y >>> 24;
        n[k] = y;
        e ? (e = z ^ a[a[a[G ^ z]]], j ^= a[a[j]]) : e = j = 1
    }
    var H = [0, 1, 2, 4, 8,
            16, 32, 64, 128, 27, 54
        ],
        d = d.AES = p.extend({
            _doReset: function () {
                for (var a = this._key, c = a.words, d = a.sigBytes / 4, a = 4 * ((this._nRounds = d + 6) + 1), e = this._keySchedule = [], j = 0; j < a; j++)
                    if (j < d) e[j] = c[j];
                    else {
                        var k = e[j - 1];
                        j % d ? 6 < d && 4 == j % d && (k = l[k >>> 24] << 24 | l[k >>> 16 & 255] << 16 | l[k >>> 8 & 255] << 8 | l[k & 255]) : (k = k << 8 | k >>> 24, k = l[k >>> 24] << 24 | l[k >>> 16 & 255] << 16 | l[k >>> 8 & 255] << 8 | l[k & 255], k ^= H[j / d | 0] << 24);
                        e[j] = e[j - d] ^ k
                    } c = this._invKeySchedule = [];
                for (d = 0; d < a; d++) j = a - d, k = d % 4 ? e[j] : e[j - 4], c[d] = 4 > d || 4 >= j ? k : b[l[k >>> 24]] ^ x[l[k >>> 16 & 255]] ^ q[l[k >>>
                    8 & 255]] ^ n[l[k & 255]]
            },
            encryptBlock: function (a, b) {
                this._doCryptBlock(a, b, this._keySchedule, t, r, w, v, l)
            },
            decryptBlock: function (a, c) {
                var d = a[c + 1];
                a[c + 1] = a[c + 3];
                a[c + 3] = d;
                this._doCryptBlock(a, c, this._invKeySchedule, b, x, q, n, s);
                d = a[c + 1];
                a[c + 1] = a[c + 3];
                a[c + 3] = d
            },
            _doCryptBlock: function (a, b, c, d, e, j, l, f) {
                for (var m = this._nRounds, g = a[b] ^ c[0], h = a[b + 1] ^ c[1], k = a[b + 2] ^ c[2], n = a[b + 3] ^ c[3], p = 4, r = 1; r < m; r++) var q = d[g >>> 24] ^ e[h >>> 16 & 255] ^ j[k >>> 8 & 255] ^ l[n & 255] ^ c[p++],
                    s = d[h >>> 24] ^ e[k >>> 16 & 255] ^ j[n >>> 8 & 255] ^ l[g & 255] ^ c[p++],
                    t =
                    d[k >>> 24] ^ e[n >>> 16 & 255] ^ j[g >>> 8 & 255] ^ l[h & 255] ^ c[p++],
                    n = d[n >>> 24] ^ e[g >>> 16 & 255] ^ j[h >>> 8 & 255] ^ l[k & 255] ^ c[p++],
                    g = q,
                    h = s,
                    k = t;
                q = (f[g >>> 24] << 24 | f[h >>> 16 & 255] << 16 | f[k >>> 8 & 255] << 8 | f[n & 255]) ^ c[p++];
                s = (f[h >>> 24] << 24 | f[k >>> 16 & 255] << 16 | f[n >>> 8 & 255] << 8 | f[g & 255]) ^ c[p++];
                t = (f[k >>> 24] << 24 | f[n >>> 16 & 255] << 16 | f[g >>> 8 & 255] << 8 | f[h & 255]) ^ c[p++];
                n = (f[n >>> 24] << 24 | f[g >>> 16 & 255] << 16 | f[h >>> 8 & 255] << 8 | f[k & 255]) ^ c[p++];
                a[b] = q;
                a[b + 1] = s;
                a[b + 2] = t;
                a[b + 3] = n
            },
            keySize: 8
        });
    u.AES = p._createHelper(d)
})();
var CryptoJS = CryptoJS || function (s, p) {
    var m = {},
        l = m.lib = {},
        n = function () {},
        r = l.Base = {
            extend: function (b) {
                n.prototype = this;
                var h = new n;
                b && h.mixIn(b);
                h.hasOwnProperty("init") || (h.init = function () {
                    h.$super.init.apply(this, arguments)
                });
                h.init.prototype = h;
                h.$super = this;
                return h
            },
            create: function () {
                var b = this.extend();
                b.init.apply(b, arguments);
                return b
            },
            init: function () {},
            mixIn: function (b) {
                for (var h in b) b.hasOwnProperty(h) && (this[h] = b[h]);
                b.hasOwnProperty("toString") && (this.toString = b.toString)
            },
            clone: function () {
                return this.init.prototype.extend(this)
            }
        },
        q = l.WordArray = r.extend({
            init: function (b, h) {
                b = this.words = b || [];
                this.sigBytes = h != p ? h : 4 * b.length
            },
            toString: function (b) {
                return (b || t).stringify(this)
            },
            concat: function (b) {
                var h = this.words,
                    a = b.words,
                    j = this.sigBytes;
                b = b.sigBytes;
                this.clamp();
                if (j % 4)
                    for (var g = 0; g < b; g++) h[j + g >>> 2] |= (a[g >>> 2] >>> 24 - 8 * (g % 4) & 255) << 24 - 8 * ((j + g) % 4);
                else if (65535 < a.length)
                    for (g = 0; g < b; g += 4) h[j + g >>> 2] = a[g >>> 2];
                else h.push.apply(h, a);
                this.sigBytes += b;
                return this
            },
            clamp: function () {
                var b = this.words,
                    h = this.sigBytes;
                b[h >>> 2] &= 4294967295 <<
                    32 - 8 * (h % 4);
                b.length = s.ceil(h / 4)
            },
            clone: function () {
                var b = r.clone.call(this);
                b.words = this.words.slice(0);
                return b
            },
            random: function (b) {
                for (var h = [], a = 0; a < b; a += 4) h.push(4294967296 * s.random() | 0);
                return new q.init(h, b)
            }
        }),
        v = m.enc = {},
        t = v.Hex = {
            stringify: function (b) {
                var a = b.words;
                b = b.sigBytes;
                for (var g = [], j = 0; j < b; j++) {
                    var k = a[j >>> 2] >>> 24 - 8 * (j % 4) & 255;
                    g.push((k >>> 4).toString(16));
                    g.push((k & 15).toString(16))
                }
                return g.join("")
            },
            parse: function (b) {
                for (var a = b.length, g = [], j = 0; j < a; j += 2) g[j >>> 3] |= parseInt(b.substr(j,
                    2), 16) << 24 - 4 * (j % 8);
                return new q.init(g, a / 2)
            }
        },
        a = v.Latin1 = {
            stringify: function (b) {
                var a = b.words;
                b = b.sigBytes;
                for (var g = [], j = 0; j < b; j++) g.push(String.fromCharCode(a[j >>> 2] >>> 24 - 8 * (j % 4) & 255));
                return g.join("")
            },
            parse: function (b) {
                for (var a = b.length, g = [], j = 0; j < a; j++) g[j >>> 2] |= (b.charCodeAt(j) & 255) << 24 - 8 * (j % 4);
                return new q.init(g, a)
            }
        },
        u = v.Utf8 = {
            stringify: function (b) {
                try {
                    return decodeURIComponent(escape(a.stringify(b)))
                } catch (g) {
                    throw Error("Malformed UTF-8 data");
                }
            },
            parse: function (b) {
                return a.parse(unescape(encodeURIComponent(b)))
            }
        },
        g = l.BufferedBlockAlgorithm = r.extend({
            reset: function () {
                this._data = new q.init;
                this._nDataBytes = 0
            },
            _append: function (b) {
                "string" == typeof b && (b = u.parse(b));
                this._data.concat(b);
                this._nDataBytes += b.sigBytes
            },
            _process: function (b) {
                var a = this._data,
                    g = a.words,
                    j = a.sigBytes,
                    k = this.blockSize,
                    m = j / (4 * k),
                    m = b ? s.ceil(m) : s.max((m | 0) - this._minBufferSize, 0);
                b = m * k;
                j = s.min(4 * b, j);
                if (b) {
                    for (var l = 0; l < b; l += k) this._doProcessBlock(g, l);
                    l = g.splice(0, b);
                    a.sigBytes -= j
                }
                return new q.init(l, j)
            },
            clone: function () {
                var b = r.clone.call(this);
                b._data = this._data.clone();
                return b
            },
            _minBufferSize: 0
        });
    l.Hasher = g.extend({
        cfg: r.extend(),
        init: function (b) {
            this.cfg = this.cfg.extend(b);
            this.reset()
        },
        reset: function () {
            g.reset.call(this);
            this._doReset()
        },
        update: function (b) {
            this._append(b);
            this._process();
            return this
        },
        finalize: function (b) {
            b && this._append(b);
            return this._doFinalize()
        },
        blockSize: 16,
        _createHelper: function (b) {
            return function (a, g) {
                return (new b.init(g)).finalize(a)
            }
        },
        _createHmacHelper: function (b) {
            return function (a, g) {
                return (new k.HMAC.init(b,
                    g)).finalize(a)
            }
        }
    });
    var k = m.algo = {};
    return m
}(Math);
(function (s) {
    function p(a, k, b, h, l, j, m) {
        a = a + (k & b | ~k & h) + l + m;
        return (a << j | a >>> 32 - j) + k
    }

    function m(a, k, b, h, l, j, m) {
        a = a + (k & h | b & ~h) + l + m;
        return (a << j | a >>> 32 - j) + k
    }

    function l(a, k, b, h, l, j, m) {
        a = a + (k ^ b ^ h) + l + m;
        return (a << j | a >>> 32 - j) + k
    }

    function n(a, k, b, h, l, j, m) {
        a = a + (b ^ (k | ~h)) + l + m;
        return (a << j | a >>> 32 - j) + k
    }
    for (var r = CryptoJS, q = r.lib, v = q.WordArray, t = q.Hasher, q = r.algo, a = [], u = 0; 64 > u; u++) a[u] = 4294967296 * s.abs(s.sin(u + 1)) | 0;
    q = q.MD5 = t.extend({
        _doReset: function () {
            this._hash = new v.init([1732584193, 4023233417, 2562383102, 271733878])
        },
        _doProcessBlock: function (g, k) {
            for (var b = 0; 16 > b; b++) {
                var h = k + b,
                    w = g[h];
                g[h] = (w << 8 | w >>> 24) & 16711935 | (w << 24 | w >>> 8) & 4278255360
            }
            var b = this._hash.words,
                h = g[k + 0],
                w = g[k + 1],
                j = g[k + 2],
                q = g[k + 3],
                r = g[k + 4],
                s = g[k + 5],
                t = g[k + 6],
                u = g[k + 7],
                v = g[k + 8],
                x = g[k + 9],
                y = g[k + 10],
                z = g[k + 11],
                A = g[k + 12],
                B = g[k + 13],
                C = g[k + 14],
                D = g[k + 15],
                c = b[0],
                d = b[1],
                e = b[2],
                f = b[3],
                c = p(c, d, e, f, h, 7, a[0]),
                f = p(f, c, d, e, w, 12, a[1]),
                e = p(e, f, c, d, j, 17, a[2]),
                d = p(d, e, f, c, q, 22, a[3]),
                c = p(c, d, e, f, r, 7, a[4]),
                f = p(f, c, d, e, s, 12, a[5]),
                e = p(e, f, c, d, t, 17, a[6]),
                d = p(d, e, f, c, u, 22, a[7]),
                c = p(c, d, e, f, v, 7, a[8]),
                f = p(f, c, d, e, x, 12, a[9]),
                e = p(e, f, c, d, y, 17, a[10]),
                d = p(d, e, f, c, z, 22, a[11]),
                c = p(c, d, e, f, A, 7, a[12]),
                f = p(f, c, d, e, B, 12, a[13]),
                e = p(e, f, c, d, C, 17, a[14]),
                d = p(d, e, f, c, D, 22, a[15]),
                c = m(c, d, e, f, w, 5, a[16]),
                f = m(f, c, d, e, t, 9, a[17]),
                e = m(e, f, c, d, z, 14, a[18]),
                d = m(d, e, f, c, h, 20, a[19]),
                c = m(c, d, e, f, s, 5, a[20]),
                f = m(f, c, d, e, y, 9, a[21]),
                e = m(e, f, c, d, D, 14, a[22]),
                d = m(d, e, f, c, r, 20, a[23]),
                c = m(c, d, e, f, x, 5, a[24]),
                f = m(f, c, d, e, C, 9, a[25]),
                e = m(e, f, c, d, q, 14, a[26]),
                d = m(d, e, f, c, v, 20, a[27]),
                c = m(c, d, e, f, B, 5, a[28]),
                f = m(f, c,
                    d, e, j, 9, a[29]),
                e = m(e, f, c, d, u, 14, a[30]),
                d = m(d, e, f, c, A, 20, a[31]),
                c = l(c, d, e, f, s, 4, a[32]),
                f = l(f, c, d, e, v, 11, a[33]),
                e = l(e, f, c, d, z, 16, a[34]),
                d = l(d, e, f, c, C, 23, a[35]),
                c = l(c, d, e, f, w, 4, a[36]),
                f = l(f, c, d, e, r, 11, a[37]),
                e = l(e, f, c, d, u, 16, a[38]),
                d = l(d, e, f, c, y, 23, a[39]),
                c = l(c, d, e, f, B, 4, a[40]),
                f = l(f, c, d, e, h, 11, a[41]),
                e = l(e, f, c, d, q, 16, a[42]),
                d = l(d, e, f, c, t, 23, a[43]),
                c = l(c, d, e, f, x, 4, a[44]),
                f = l(f, c, d, e, A, 11, a[45]),
                e = l(e, f, c, d, D, 16, a[46]),
                d = l(d, e, f, c, j, 23, a[47]),
                c = n(c, d, e, f, h, 6, a[48]),
                f = n(f, c, d, e, u, 10, a[49]),
                e = n(e, f, c, d,
                    C, 15, a[50]),
                d = n(d, e, f, c, s, 21, a[51]),
                c = n(c, d, e, f, A, 6, a[52]),
                f = n(f, c, d, e, q, 10, a[53]),
                e = n(e, f, c, d, y, 15, a[54]),
                d = n(d, e, f, c, w, 21, a[55]),
                c = n(c, d, e, f, v, 6, a[56]),
                f = n(f, c, d, e, D, 10, a[57]),
                e = n(e, f, c, d, t, 15, a[58]),
                d = n(d, e, f, c, B, 21, a[59]),
                c = n(c, d, e, f, r, 6, a[60]),
                f = n(f, c, d, e, z, 10, a[61]),
                e = n(e, f, c, d, j, 15, a[62]),
                d = n(d, e, f, c, x, 21, a[63]);
            b[0] = b[0] + c | 0;
            b[1] = b[1] + d | 0;
            b[2] = b[2] + e | 0;
            b[3] = b[3] + f | 0
        },
        _doFinalize: function () {
            var a = this._data,
                k = a.words,
                b = 8 * this._nDataBytes,
                h = 8 * a.sigBytes;
            k[h >>> 5] |= 128 << 24 - h % 32;
            var l = s.floor(b /
                4294967296);
            k[(h + 64 >>> 9 << 4) + 15] = (l << 8 | l >>> 24) & 16711935 | (l << 24 | l >>> 8) & 4278255360;
            k[(h + 64 >>> 9 << 4) + 14] = (b << 8 | b >>> 24) & 16711935 | (b << 24 | b >>> 8) & 4278255360;
            a.sigBytes = 4 * (k.length + 1);
            this._process();
            a = this._hash;
            k = a.words;
            for (b = 0; 4 > b; b++) h = k[b], k[b] = (h << 8 | h >>> 24) & 16711935 | (h << 24 | h >>> 8) & 4278255360;
            return a
        },
        clone: function () {
            var a = t.clone.call(this);
            a._hash = this._hash.clone();
            return a
        }
    });
    r.MD5 = t._createHelper(q);
    r.HmacMD5 = t._createHmacHelper(q)
})(Math);
var CryptoJS = CryptoJS || function (e, m) {
    var p = {},
        j = p.lib = {},
        l = function () {},
        f = j.Base = {
            extend: function (a) {
                l.prototype = this;
                var c = new l;
                a && c.mixIn(a);
                c.hasOwnProperty("init") || (c.init = function () {
                    c.$super.init.apply(this, arguments)
                });
                c.init.prototype = c;
                c.$super = this;
                return c
            },
            create: function () {
                var a = this.extend();
                a.init.apply(a, arguments);
                return a
            },
            init: function () {},
            mixIn: function (a) {
                for (var c in a) a.hasOwnProperty(c) && (this[c] = a[c]);
                a.hasOwnProperty("toString") && (this.toString = a.toString)
            },
            clone: function () {
                return this.init.prototype.extend(this)
            }
        },
        n = j.WordArray = f.extend({
            init: function (a, c) {
                a = this.words = a || [];
                this.sigBytes = c != m ? c : 4 * a.length
            },
            toString: function (a) {
                return (a || h).stringify(this)
            },
            concat: function (a) {
                var c = this.words,
                    q = a.words,
                    d = this.sigBytes;
                a = a.sigBytes;
                this.clamp();
                if (d % 4)
                    for (var b = 0; b < a; b++) c[d + b >>> 2] |= (q[b >>> 2] >>> 24 - 8 * (b % 4) & 255) << 24 - 8 * ((d + b) % 4);
                else if (65535 < q.length)
                    for (b = 0; b < a; b += 4) c[d + b >>> 2] = q[b >>> 2];
                else c.push.apply(c, q);
                this.sigBytes += a;
                return this
            },
            clamp: function () {
                var a = this.words,
                    c = this.sigBytes;
                a[c >>> 2] &= 4294967295 <<
                    32 - 8 * (c % 4);
                a.length = e.ceil(c / 4)
            },
            clone: function () {
                var a = f.clone.call(this);
                a.words = this.words.slice(0);
                return a
            },
            random: function (a) {
                for (var c = [], b = 0; b < a; b += 4) c.push(4294967296 * e.random() | 0);
                return new n.init(c, a)
            }
        }),
        b = p.enc = {},
        h = b.Hex = {
            stringify: function (a) {
                var c = a.words;
                a = a.sigBytes;
                for (var b = [], d = 0; d < a; d++) {
                    var f = c[d >>> 2] >>> 24 - 8 * (d % 4) & 255;
                    b.push((f >>> 4).toString(16));
                    b.push((f & 15).toString(16))
                }
                return b.join("")
            },
            parse: function (a) {
                for (var c = a.length, b = [], d = 0; d < c; d += 2) b[d >>> 3] |= parseInt(a.substr(d,
                    2), 16) << 24 - 4 * (d % 8);
                return new n.init(b, c / 2)
            }
        },
        g = b.Latin1 = {
            stringify: function (a) {
                var c = a.words;
                a = a.sigBytes;
                for (var b = [], d = 0; d < a; d++) b.push(String.fromCharCode(c[d >>> 2] >>> 24 - 8 * (d % 4) & 255));
                return b.join("")
            },
            parse: function (a) {
                for (var c = a.length, b = [], d = 0; d < c; d++) b[d >>> 2] |= (a.charCodeAt(d) & 255) << 24 - 8 * (d % 4);
                return new n.init(b, c)
            }
        },
        r = b.Utf8 = {
            stringify: function (a) {
                try {
                    return decodeURIComponent(escape(g.stringify(a)))
                } catch (c) {
                    throw Error("Malformed UTF-8 data");
                }
            },
            parse: function (a) {
                return g.parse(unescape(encodeURIComponent(a)))
            }
        },
        k = j.BufferedBlockAlgorithm = f.extend({
            reset: function () {
                this._data = new n.init;
                this._nDataBytes = 0
            },
            _append: function (a) {
                "string" == typeof a && (a = r.parse(a));
                this._data.concat(a);
                this._nDataBytes += a.sigBytes
            },
            _process: function (a) {
                var c = this._data,
                    b = c.words,
                    d = c.sigBytes,
                    f = this.blockSize,
                    h = d / (4 * f),
                    h = a ? e.ceil(h) : e.max((h | 0) - this._minBufferSize, 0);
                a = h * f;
                d = e.min(4 * a, d);
                if (a) {
                    for (var g = 0; g < a; g += f) this._doProcessBlock(b, g);
                    g = b.splice(0, a);
                    c.sigBytes -= d
                }
                return new n.init(g, d)
            },
            clone: function () {
                var a = f.clone.call(this);
                a._data = this._data.clone();
                return a
            },
            _minBufferSize: 0
        });
    j.Hasher = k.extend({
        cfg: f.extend(),
        init: function (a) {
            this.cfg = this.cfg.extend(a);
            this.reset()
        },
        reset: function () {
            k.reset.call(this);
            this._doReset()
        },
        update: function (a) {
            this._append(a);
            this._process();
            return this
        },
        finalize: function (a) {
            a && this._append(a);
            return this._doFinalize()
        },
        blockSize: 16,
        _createHelper: function (a) {
            return function (c, b) {
                return (new a.init(b)).finalize(c)
            }
        },
        _createHmacHelper: function (a) {
            return function (b, f) {
                return (new s.HMAC.init(a,
                    f)).finalize(b)
            }
        }
    });
    var s = p.algo = {};
    return p
}(Math);
(function () {
    var e = CryptoJS,
        m = e.lib,
        p = m.WordArray,
        j = m.Hasher,
        l = [],
        m = e.algo.SHA1 = j.extend({
            _doReset: function () {
                this._hash = new p.init([1732584193, 4023233417, 2562383102, 271733878, 3285377520])
            },
            _doProcessBlock: function (f, n) {
                for (var b = this._hash.words, h = b[0], g = b[1], e = b[2], k = b[3], j = b[4], a = 0; 80 > a; a++) {
                    if (16 > a) l[a] = f[n + a] | 0;
                    else {
                        var c = l[a - 3] ^ l[a - 8] ^ l[a - 14] ^ l[a - 16];
                        l[a] = c << 1 | c >>> 31
                    }
                    c = (h << 5 | h >>> 27) + j + l[a];
                    c = 20 > a ? c + ((g & e | ~g & k) + 1518500249) : 40 > a ? c + ((g ^ e ^ k) + 1859775393) : 60 > a ? c + ((g & e | g & k | e & k) - 1894007588) : c + ((g ^ e ^
                        k) - 899497514);
                    j = k;
                    k = e;
                    e = g << 30 | g >>> 2;
                    g = h;
                    h = c
                }
                b[0] = b[0] + h | 0;
                b[1] = b[1] + g | 0;
                b[2] = b[2] + e | 0;
                b[3] = b[3] + k | 0;
                b[4] = b[4] + j | 0
            },
            _doFinalize: function () {
                var f = this._data,
                    e = f.words,
                    b = 8 * this._nDataBytes,
                    h = 8 * f.sigBytes;
                e[h >>> 5] |= 128 << 24 - h % 32;
                e[(h + 64 >>> 9 << 4) + 14] = Math.floor(b / 4294967296);
                e[(h + 64 >>> 9 << 4) + 15] = b;
                f.sigBytes = 4 * e.length;
                this._process();
                return this._hash
            },
            clone: function () {
                var e = j.clone.call(this);
                e._hash = this._hash.clone();
                return e
            }
        });
    e.SHA1 = j._createHelper(m);
    e.HmacSHA1 = j._createHmacHelper(m)
})();
var CryptoJS = CryptoJS || function (v, p) {
    var d = {},
        u = d.lib = {},
        r = function () {},
        f = u.Base = {
            extend: function (a) {
                r.prototype = this;
                var b = new r;
                a && b.mixIn(a);
                b.hasOwnProperty("init") || (b.init = function () {
                    b.$super.init.apply(this, arguments)
                });
                b.init.prototype = b;
                b.$super = this;
                return b
            },
            create: function () {
                var a = this.extend();
                a.init.apply(a, arguments);
                return a
            },
            init: function () {},
            mixIn: function (a) {
                for (var b in a) a.hasOwnProperty(b) && (this[b] = a[b]);
                a.hasOwnProperty("toString") && (this.toString = a.toString)
            },
            clone: function () {
                return this.init.prototype.extend(this)
            }
        },
        s = u.WordArray = f.extend({
            init: function (a, b) {
                a = this.words = a || [];
                this.sigBytes = b != p ? b : 4 * a.length
            },
            toString: function (a) {
                return (a || y).stringify(this)
            },
            concat: function (a) {
                var b = this.words,
                    c = a.words,
                    j = this.sigBytes;
                a = a.sigBytes;
                this.clamp();
                if (j % 4)
                    for (var n = 0; n < a; n++) b[j + n >>> 2] |= (c[n >>> 2] >>> 24 - 8 * (n % 4) & 255) << 24 - 8 * ((j + n) % 4);
                else if (65535 < c.length)
                    for (n = 0; n < a; n += 4) b[j + n >>> 2] = c[n >>> 2];
                else b.push.apply(b, c);
                this.sigBytes += a;
                return this
            },
            clamp: function () {
                var a = this.words,
                    b = this.sigBytes;
                a[b >>> 2] &= 4294967295 <<
                    32 - 8 * (b % 4);
                a.length = v.ceil(b / 4)
            },
            clone: function () {
                var a = f.clone.call(this);
                a.words = this.words.slice(0);
                return a
            },
            random: function (a) {
                for (var b = [], c = 0; c < a; c += 4) b.push(4294967296 * v.random() | 0);
                return new s.init(b, a)
            }
        }),
        x = d.enc = {},
        y = x.Hex = {
            stringify: function (a) {
                var b = a.words;
                a = a.sigBytes;
                for (var c = [], j = 0; j < a; j++) {
                    var n = b[j >>> 2] >>> 24 - 8 * (j % 4) & 255;
                    c.push((n >>> 4).toString(16));
                    c.push((n & 15).toString(16))
                }
                return c.join("")
            },
            parse: function (a) {
                for (var b = a.length, c = [], j = 0; j < b; j += 2) c[j >>> 3] |= parseInt(a.substr(j,
                    2), 16) << 24 - 4 * (j % 8);
                return new s.init(c, b / 2)
            }
        },
        e = x.Latin1 = {
            stringify: function (a) {
                var b = a.words;
                a = a.sigBytes;
                for (var c = [], j = 0; j < a; j++) c.push(String.fromCharCode(b[j >>> 2] >>> 24 - 8 * (j % 4) & 255));
                return c.join("")
            },
            parse: function (a) {
                for (var b = a.length, c = [], j = 0; j < b; j++) c[j >>> 2] |= (a.charCodeAt(j) & 255) << 24 - 8 * (j % 4);
                return new s.init(c, b)
            }
        },
        q = x.Utf8 = {
            stringify: function (a) {
                try {
                    return decodeURIComponent(escape(e.stringify(a)))
                } catch (b) {
                    throw Error("Malformed UTF-8 data");
                }
            },
            parse: function (a) {
                return e.parse(unescape(encodeURIComponent(a)))
            }
        },
        t = u.BufferedBlockAlgorithm = f.extend({
            reset: function () {
                this._data = new s.init;
                this._nDataBytes = 0
            },
            _append: function (a) {
                "string" == typeof a && (a = q.parse(a));
                this._data.concat(a);
                this._nDataBytes += a.sigBytes
            },
            _process: function (a) {
                var b = this._data,
                    c = b.words,
                    j = b.sigBytes,
                    n = this.blockSize,
                    e = j / (4 * n),
                    e = a ? v.ceil(e) : v.max((e | 0) - this._minBufferSize, 0);
                a = e * n;
                j = v.min(4 * a, j);
                if (a) {
                    for (var f = 0; f < a; f += n) this._doProcessBlock(c, f);
                    f = c.splice(0, a);
                    b.sigBytes -= j
                }
                return new s.init(f, j)
            },
            clone: function () {
                var a = f.clone.call(this);
                a._data = this._data.clone();
                return a
            },
            _minBufferSize: 0
        });
    u.Hasher = t.extend({
        cfg: f.extend(),
        init: function (a) {
            this.cfg = this.cfg.extend(a);
            this.reset()
        },
        reset: function () {
            t.reset.call(this);
            this._doReset()
        },
        update: function (a) {
            this._append(a);
            this._process();
            return this
        },
        finalize: function (a) {
            a && this._append(a);
            return this._doFinalize()
        },
        blockSize: 16,
        _createHelper: function (a) {
            return function (b, c) {
                return (new a.init(c)).finalize(b)
            }
        },
        _createHmacHelper: function (a) {
            return function (b, c) {
                return (new w.HMAC.init(a,
                    c)).finalize(b)
            }
        }
    });
    var w = d.algo = {};
    return d
}(Math);
(function (v) {
    var p = CryptoJS,
        d = p.lib,
        u = d.Base,
        r = d.WordArray,
        p = p.x64 = {};
    p.Word = u.extend({
        init: function (f, s) {
            this.high = f;
            this.low = s
        }
    });
    p.WordArray = u.extend({
        init: function (f, s) {
            f = this.words = f || [];
            this.sigBytes = s != v ? s : 8 * f.length
        },
        toX32: function () {
            for (var f = this.words, s = f.length, d = [], p = 0; p < s; p++) {
                var e = f[p];
                d.push(e.high);
                d.push(e.low)
            }
            return r.create(d, this.sigBytes)
        },
        clone: function () {
            for (var f = u.clone.call(this), d = f.words = this.words.slice(0), p = d.length, r = 0; r < p; r++) d[r] = d[r].clone();
            return f
        }
    })
})();
(function (v) {
    for (var p = CryptoJS, d = p.lib, u = d.WordArray, r = d.Hasher, f = p.x64.Word, d = p.algo, s = [], x = [], y = [], e = 1, q = 0, t = 0; 24 > t; t++) {
        s[e + 5 * q] = (t + 1) * (t + 2) / 2 % 64;
        var w = (2 * e + 3 * q) % 5,
            e = q % 5,
            q = w
    }
    for (e = 0; 5 > e; e++)
        for (q = 0; 5 > q; q++) x[e + 5 * q] = q + 5 * ((2 * e + 3 * q) % 5);
    e = 1;
    for (q = 0; 24 > q; q++) {
        for (var a = w = t = 0; 7 > a; a++) {
            if (e & 1) {
                var b = (1 << a) - 1;
                32 > b ? w ^= 1 << b : t ^= 1 << b - 32
            }
            e = e & 128 ? e << 1 ^ 113 : e << 1
        }
        y[q] = f.create(t, w)
    }
    for (var c = [], e = 0; 25 > e; e++) c[e] = f.create();
    d = d.SHA3 = r.extend({
        cfg: r.cfg.extend({
            outputLength: 512
        }),
        _doReset: function () {
            for (var a = this._state = [], b = 0; 25 > b; b++) a[b] = new f.init;
            this.blockSize = (1600 - 2 * this.cfg.outputLength) / 32
        },
        _doProcessBlock: function (a, b) {
            for (var e = this._state, f = this.blockSize / 2, h = 0; h < f; h++) {
                var l = a[b + 2 * h],
                    m = a[b + 2 * h + 1],
                    l = (l << 8 | l >>> 24) & 16711935 | (l << 24 | l >>> 8) & 4278255360,
                    m = (m << 8 | m >>> 24) & 16711935 | (m << 24 | m >>> 8) & 4278255360,
                    g = e[h];
                g.high ^= m;
                g.low ^= l
            }
            for (f = 0; 24 > f; f++) {
                for (h = 0; 5 > h; h++) {
                    for (var d = l = 0, k = 0; 5 > k; k++) g = e[h + 5 * k], l ^= g.high, d ^= g.low;
                    g = c[h];
                    g.high = l;
                    g.low = d
                }
                for (h = 0; 5 > h; h++) {
                    g = c[(h + 4) % 5];
                    l = c[(h + 1) % 5];
                    m = l.high;
                    k = l.low;
                    l = g.high ^
                        (m << 1 | k >>> 31);
                    d = g.low ^ (k << 1 | m >>> 31);
                    for (k = 0; 5 > k; k++) g = e[h + 5 * k], g.high ^= l, g.low ^= d
                }
                for (m = 1; 25 > m; m++) g = e[m], h = g.high, g = g.low, k = s[m], 32 > k ? (l = h << k | g >>> 32 - k, d = g << k | h >>> 32 - k) : (l = g << k - 32 | h >>> 64 - k, d = h << k - 32 | g >>> 64 - k), g = c[x[m]], g.high = l, g.low = d;
                g = c[0];
                h = e[0];
                g.high = h.high;
                g.low = h.low;
                for (h = 0; 5 > h; h++)
                    for (k = 0; 5 > k; k++) m = h + 5 * k, g = e[m], l = c[m], m = c[(h + 1) % 5 + 5 * k], d = c[(h + 2) % 5 + 5 * k], g.high = l.high ^ ~m.high & d.high, g.low = l.low ^ ~m.low & d.low;
                g = e[0];
                h = y[f];
                g.high ^= h.high;
                g.low ^= h.low
            }
        },
        _doFinalize: function () {
            var a = this._data,
                b = a.words,
                c = 8 * a.sigBytes,
                e = 32 * this.blockSize;
            b[c >>> 5] |= 1 << 24 - c % 32;
            b[(v.ceil((c + 1) / e) * e >>> 5) - 1] |= 128;
            a.sigBytes = 4 * b.length;
            this._process();
            for (var a = this._state, b = this.cfg.outputLength / 8, c = b / 8, e = [], h = 0; h < c; h++) {
                var d = a[h],
                    f = d.high,
                    d = d.low,
                    f = (f << 8 | f >>> 24) & 16711935 | (f << 24 | f >>> 8) & 4278255360,
                    d = (d << 8 | d >>> 24) & 16711935 | (d << 24 | d >>> 8) & 4278255360;
                e.push(d);
                e.push(f)
            }
            return new u.init(e, b)
        },
        clone: function () {
            for (var a = r.clone.call(this), b = a._state = this._state.slice(0), c = 0; 25 > c; c++) b[c] = b[c].clone();
            return a
        }
    });
    p.SHA3 = r._createHelper(d);
    p.HmacSHA3 = r._createHmacHelper(d)
})(Math);
var CryptoJS = CryptoJS || function (g, l) {
    var f = {},
        k = f.lib = {},
        h = function () {},
        m = k.Base = {
            extend: function (a) {
                h.prototype = this;
                var c = new h;
                a && c.mixIn(a);
                c.hasOwnProperty("init") || (c.init = function () {
                    c.$super.init.apply(this, arguments)
                });
                c.init.prototype = c;
                c.$super = this;
                return c
            },
            create: function () {
                var a = this.extend();
                a.init.apply(a, arguments);
                return a
            },
            init: function () {},
            mixIn: function (a) {
                for (var c in a) a.hasOwnProperty(c) && (this[c] = a[c]);
                a.hasOwnProperty("toString") && (this.toString = a.toString)
            },
            clone: function () {
                return this.init.prototype.extend(this)
            }
        },
        q = k.WordArray = m.extend({
            init: function (a, c) {
                a = this.words = a || [];
                this.sigBytes = c != l ? c : 4 * a.length
            },
            toString: function (a) {
                return (a || s).stringify(this)
            },
            concat: function (a) {
                var c = this.words,
                    d = a.words,
                    b = this.sigBytes;
                a = a.sigBytes;
                this.clamp();
                if (b % 4)
                    for (var e = 0; e < a; e++) c[b + e >>> 2] |= (d[e >>> 2] >>> 24 - 8 * (e % 4) & 255) << 24 - 8 * ((b + e) % 4);
                else if (65535 < d.length)
                    for (e = 0; e < a; e += 4) c[b + e >>> 2] = d[e >>> 2];
                else c.push.apply(c, d);
                this.sigBytes += a;
                return this
            },
            clamp: function () {
                var a = this.words,
                    c = this.sigBytes;
                a[c >>> 2] &= 4294967295 <<
                    32 - 8 * (c % 4);
                a.length = g.ceil(c / 4)
            },
            clone: function () {
                var a = m.clone.call(this);
                a.words = this.words.slice(0);
                return a
            },
            random: function (a) {
                for (var c = [], d = 0; d < a; d += 4) c.push(4294967296 * g.random() | 0);
                return new q.init(c, a)
            }
        }),
        t = f.enc = {},
        s = t.Hex = {
            stringify: function (a) {
                var c = a.words;
                a = a.sigBytes;
                for (var d = [], b = 0; b < a; b++) {
                    var e = c[b >>> 2] >>> 24 - 8 * (b % 4) & 255;
                    d.push((e >>> 4).toString(16));
                    d.push((e & 15).toString(16))
                }
                return d.join("")
            },
            parse: function (a) {
                for (var c = a.length, d = [], b = 0; b < c; b += 2) d[b >>> 3] |= parseInt(a.substr(b,
                    2), 16) << 24 - 4 * (b % 8);
                return new q.init(d, c / 2)
            }
        },
        n = t.Latin1 = {
            stringify: function (a) {
                var c = a.words;
                a = a.sigBytes;
                for (var d = [], b = 0; b < a; b++) d.push(String.fromCharCode(c[b >>> 2] >>> 24 - 8 * (b % 4) & 255));
                return d.join("")
            },
            parse: function (a) {
                for (var c = a.length, d = [], b = 0; b < c; b++) d[b >>> 2] |= (a.charCodeAt(b) & 255) << 24 - 8 * (b % 4);
                return new q.init(d, c)
            }
        },
        j = t.Utf8 = {
            stringify: function (a) {
                try {
                    return decodeURIComponent(escape(n.stringify(a)))
                } catch (c) {
                    throw Error("Malformed UTF-8 data");
                }
            },
            parse: function (a) {
                return n.parse(unescape(encodeURIComponent(a)))
            }
        },
        w = k.BufferedBlockAlgorithm = m.extend({
            reset: function () {
                this._data = new q.init;
                this._nDataBytes = 0
            },
            _append: function (a) {
                "string" == typeof a && (a = j.parse(a));
                this._data.concat(a);
                this._nDataBytes += a.sigBytes
            },
            _process: function (a) {
                var c = this._data,
                    d = c.words,
                    b = c.sigBytes,
                    e = this.blockSize,
                    f = b / (4 * e),
                    f = a ? g.ceil(f) : g.max((f | 0) - this._minBufferSize, 0);
                a = f * e;
                b = g.min(4 * a, b);
                if (a) {
                    for (var u = 0; u < a; u += e) this._doProcessBlock(d, u);
                    u = d.splice(0, a);
                    c.sigBytes -= b
                }
                return new q.init(u, b)
            },
            clone: function () {
                var a = m.clone.call(this);
                a._data = this._data.clone();
                return a
            },
            _minBufferSize: 0
        });
    k.Hasher = w.extend({
        cfg: m.extend(),
        init: function (a) {
            this.cfg = this.cfg.extend(a);
            this.reset()
        },
        reset: function () {
            w.reset.call(this);
            this._doReset()
        },
        update: function (a) {
            this._append(a);
            this._process();
            return this
        },
        finalize: function (a) {
            a && this._append(a);
            return this._doFinalize()
        },
        blockSize: 16,
        _createHelper: function (a) {
            return function (c, d) {
                return (new a.init(d)).finalize(c)
            }
        },
        _createHmacHelper: function (a) {
            return function (c, d) {
                return (new v.HMAC.init(a,
                    d)).finalize(c)
            }
        }
    });
    var v = f.algo = {};
    return f
}(Math);
(function (g) {
    for (var l = CryptoJS, f = l.lib, k = f.WordArray, h = f.Hasher, f = l.algo, m = [], q = [], t = function (a) {
            return 4294967296 * (a - (a | 0)) | 0
        }, s = 2, n = 0; 64 > n;) {
        var j;
        a: {
            j = s;
            for (var w = g.sqrt(j), v = 2; v <= w; v++)
                if (!(j % v)) {
                    j = !1;
                    break a
                } j = !0
        }
        j && (8 > n && (m[n] = t(g.pow(s, 0.5))), q[n] = t(g.pow(s, 1 / 3)), n++);
        s++
    }
    var a = [],
        f = f.SHA256 = h.extend({
            _doReset: function () {
                this._hash = new k.init(m.slice(0))
            },
            _doProcessBlock: function (c, d) {
                for (var b = this._hash.words, e = b[0], f = b[1], g = b[2], k = b[3], h = b[4], l = b[5], m = b[6], n = b[7], p = 0; 64 > p; p++) {
                    if (16 > p) a[p] =
                        c[d + p] | 0;
                    else {
                        var j = a[p - 15],
                            r = a[p - 2];
                        a[p] = ((j << 25 | j >>> 7) ^ (j << 14 | j >>> 18) ^ j >>> 3) + a[p - 7] + ((r << 15 | r >>> 17) ^ (r << 13 | r >>> 19) ^ r >>> 10) + a[p - 16]
                    }
                    j = n + ((h << 26 | h >>> 6) ^ (h << 21 | h >>> 11) ^ (h << 7 | h >>> 25)) + (h & l ^ ~h & m) + q[p] + a[p];
                    r = ((e << 30 | e >>> 2) ^ (e << 19 | e >>> 13) ^ (e << 10 | e >>> 22)) + (e & f ^ e & g ^ f & g);
                    n = m;
                    m = l;
                    l = h;
                    h = k + j | 0;
                    k = g;
                    g = f;
                    f = e;
                    e = j + r | 0
                }
                b[0] = b[0] + e | 0;
                b[1] = b[1] + f | 0;
                b[2] = b[2] + g | 0;
                b[3] = b[3] + k | 0;
                b[4] = b[4] + h | 0;
                b[5] = b[5] + l | 0;
                b[6] = b[6] + m | 0;
                b[7] = b[7] + n | 0
            },
            _doFinalize: function () {
                var a = this._data,
                    d = a.words,
                    b = 8 * this._nDataBytes,
                    e = 8 * a.sigBytes;
                d[e >>> 5] |= 128 << 24 - e % 32;
                d[(e + 64 >>> 9 << 4) + 14] = g.floor(b / 4294967296);
                d[(e + 64 >>> 9 << 4) + 15] = b;
                a.sigBytes = 4 * d.length;
                this._process();
                return this._hash
            },
            clone: function () {
                var a = h.clone.call(this);
                a._hash = this._hash.clone();
                return a
            }
        });
    l.SHA256 = h._createHelper(f);
    l.HmacSHA256 = h._createHmacHelper(f)
})(Math);
(function () {
    var g = CryptoJS,
        l = g.lib.WordArray,
        f = g.algo,
        k = f.SHA256,
        f = f.SHA224 = k.extend({
            _doReset: function () {
                this._hash = new l.init([3238371032, 914150663, 812702999, 4144912697, 4290775857, 1750603025, 1694076839, 3204075428])
            },
            _doFinalize: function () {
                var f = k._doFinalize.call(this);
                f.sigBytes -= 4;
                return f
            }
        });
    g.SHA224 = k._createHelper(f);
    g.HmacSHA224 = k._createHmacHelper(f)
})();
var CryptoJS = CryptoJS || function (h, s) {
    var f = {},
        t = f.lib = {},
        g = function () {},
        j = t.Base = {
            extend: function (a) {
                g.prototype = this;
                var c = new g;
                a && c.mixIn(a);
                c.hasOwnProperty("init") || (c.init = function () {
                    c.$super.init.apply(this, arguments)
                });
                c.init.prototype = c;
                c.$super = this;
                return c
            },
            create: function () {
                var a = this.extend();
                a.init.apply(a, arguments);
                return a
            },
            init: function () {},
            mixIn: function (a) {
                for (var c in a) a.hasOwnProperty(c) && (this[c] = a[c]);
                a.hasOwnProperty("toString") && (this.toString = a.toString)
            },
            clone: function () {
                return this.init.prototype.extend(this)
            }
        },
        q = t.WordArray = j.extend({
            init: function (a, c) {
                a = this.words = a || [];
                this.sigBytes = c != s ? c : 4 * a.length
            },
            toString: function (a) {
                return (a || u).stringify(this)
            },
            concat: function (a) {
                var c = this.words,
                    d = a.words,
                    b = this.sigBytes;
                a = a.sigBytes;
                this.clamp();
                if (b % 4)
                    for (var e = 0; e < a; e++) c[b + e >>> 2] |= (d[e >>> 2] >>> 24 - 8 * (e % 4) & 255) << 24 - 8 * ((b + e) % 4);
                else if (65535 < d.length)
                    for (e = 0; e < a; e += 4) c[b + e >>> 2] = d[e >>> 2];
                else c.push.apply(c, d);
                this.sigBytes += a;
                return this
            },
            clamp: function () {
                var a = this.words,
                    c = this.sigBytes;
                a[c >>> 2] &= 4294967295 <<
                    32 - 8 * (c % 4);
                a.length = h.ceil(c / 4)
            },
            clone: function () {
                var a = j.clone.call(this);
                a.words = this.words.slice(0);
                return a
            },
            random: function (a) {
                for (var c = [], d = 0; d < a; d += 4) c.push(4294967296 * h.random() | 0);
                return new q.init(c, a)
            }
        }),
        v = f.enc = {},
        u = v.Hex = {
            stringify: function (a) {
                var c = a.words;
                a = a.sigBytes;
                for (var d = [], b = 0; b < a; b++) {
                    var e = c[b >>> 2] >>> 24 - 8 * (b % 4) & 255;
                    d.push((e >>> 4).toString(16));
                    d.push((e & 15).toString(16))
                }
                return d.join("")
            },
            parse: function (a) {
                for (var c = a.length, d = [], b = 0; b < c; b += 2) d[b >>> 3] |= parseInt(a.substr(b,
                    2), 16) << 24 - 4 * (b % 8);
                return new q.init(d, c / 2)
            }
        },
        k = v.Latin1 = {
            stringify: function (a) {
                var c = a.words;
                a = a.sigBytes;
                for (var d = [], b = 0; b < a; b++) d.push(String.fromCharCode(c[b >>> 2] >>> 24 - 8 * (b % 4) & 255));
                return d.join("")
            },
            parse: function (a) {
                for (var c = a.length, d = [], b = 0; b < c; b++) d[b >>> 2] |= (a.charCodeAt(b) & 255) << 24 - 8 * (b % 4);
                return new q.init(d, c)
            }
        },
        l = v.Utf8 = {
            stringify: function (a) {
                try {
                    return decodeURIComponent(escape(k.stringify(a)))
                } catch (c) {
                    throw Error("Malformed UTF-8 data");
                }
            },
            parse: function (a) {
                return k.parse(unescape(encodeURIComponent(a)))
            }
        },
        x = t.BufferedBlockAlgorithm = j.extend({
            reset: function () {
                this._data = new q.init;
                this._nDataBytes = 0
            },
            _append: function (a) {
                "string" == typeof a && (a = l.parse(a));
                this._data.concat(a);
                this._nDataBytes += a.sigBytes
            },
            _process: function (a) {
                var c = this._data,
                    d = c.words,
                    b = c.sigBytes,
                    e = this.blockSize,
                    f = b / (4 * e),
                    f = a ? h.ceil(f) : h.max((f | 0) - this._minBufferSize, 0);
                a = f * e;
                b = h.min(4 * a, b);
                if (a) {
                    for (var m = 0; m < a; m += e) this._doProcessBlock(d, m);
                    m = d.splice(0, a);
                    c.sigBytes -= b
                }
                return new q.init(m, b)
            },
            clone: function () {
                var a = j.clone.call(this);
                a._data = this._data.clone();
                return a
            },
            _minBufferSize: 0
        });
    t.Hasher = x.extend({
        cfg: j.extend(),
        init: function (a) {
            this.cfg = this.cfg.extend(a);
            this.reset()
        },
        reset: function () {
            x.reset.call(this);
            this._doReset()
        },
        update: function (a) {
            this._append(a);
            this._process();
            return this
        },
        finalize: function (a) {
            a && this._append(a);
            return this._doFinalize()
        },
        blockSize: 16,
        _createHelper: function (a) {
            return function (c, d) {
                return (new a.init(d)).finalize(c)
            }
        },
        _createHmacHelper: function (a) {
            return function (c, d) {
                return (new w.HMAC.init(a,
                    d)).finalize(c)
            }
        }
    });
    var w = f.algo = {};
    return f
}(Math);
(function (h) {
    for (var s = CryptoJS, f = s.lib, t = f.WordArray, g = f.Hasher, f = s.algo, j = [], q = [], v = function (a) {
            return 4294967296 * (a - (a | 0)) | 0
        }, u = 2, k = 0; 64 > k;) {
        var l;
        a: {
            l = u;
            for (var x = h.sqrt(l), w = 2; w <= x; w++)
                if (!(l % w)) {
                    l = !1;
                    break a
                } l = !0
        }
        l && (8 > k && (j[k] = v(h.pow(u, 0.5))), q[k] = v(h.pow(u, 1 / 3)), k++);
        u++
    }
    var a = [],
        f = f.SHA256 = g.extend({
            _doReset: function () {
                this._hash = new t.init(j.slice(0))
            },
            _doProcessBlock: function (c, d) {
                for (var b = this._hash.words, e = b[0], f = b[1], m = b[2], h = b[3], p = b[4], j = b[5], k = b[6], l = b[7], n = 0; 64 > n; n++) {
                    if (16 > n) a[n] =
                        c[d + n] | 0;
                    else {
                        var r = a[n - 15],
                            g = a[n - 2];
                        a[n] = ((r << 25 | r >>> 7) ^ (r << 14 | r >>> 18) ^ r >>> 3) + a[n - 7] + ((g << 15 | g >>> 17) ^ (g << 13 | g >>> 19) ^ g >>> 10) + a[n - 16]
                    }
                    r = l + ((p << 26 | p >>> 6) ^ (p << 21 | p >>> 11) ^ (p << 7 | p >>> 25)) + (p & j ^ ~p & k) + q[n] + a[n];
                    g = ((e << 30 | e >>> 2) ^ (e << 19 | e >>> 13) ^ (e << 10 | e >>> 22)) + (e & f ^ e & m ^ f & m);
                    l = k;
                    k = j;
                    j = p;
                    p = h + r | 0;
                    h = m;
                    m = f;
                    f = e;
                    e = r + g | 0
                }
                b[0] = b[0] + e | 0;
                b[1] = b[1] + f | 0;
                b[2] = b[2] + m | 0;
                b[3] = b[3] + h | 0;
                b[4] = b[4] + p | 0;
                b[5] = b[5] + j | 0;
                b[6] = b[6] + k | 0;
                b[7] = b[7] + l | 0
            },
            _doFinalize: function () {
                var a = this._data,
                    d = a.words,
                    b = 8 * this._nDataBytes,
                    e = 8 * a.sigBytes;
                d[e >>> 5] |= 128 << 24 - e % 32;
                d[(e + 64 >>> 9 << 4) + 14] = h.floor(b / 4294967296);
                d[(e + 64 >>> 9 << 4) + 15] = b;
                a.sigBytes = 4 * d.length;
                this._process();
                return this._hash
            },
            clone: function () {
                var a = g.clone.call(this);
                a._hash = this._hash.clone();
                return a
            }
        });
    s.SHA256 = g._createHelper(f);
    s.HmacSHA256 = g._createHmacHelper(f)
})(Math);
var CryptoJS = CryptoJS || function (a, c) {
    var d = {},
        j = d.lib = {},
        f = function () {},
        m = j.Base = {
            extend: function (a) {
                f.prototype = this;
                var b = new f;
                a && b.mixIn(a);
                b.hasOwnProperty("init") || (b.init = function () {
                    b.$super.init.apply(this, arguments)
                });
                b.init.prototype = b;
                b.$super = this;
                return b
            },
            create: function () {
                var a = this.extend();
                a.init.apply(a, arguments);
                return a
            },
            init: function () {},
            mixIn: function (a) {
                for (var b in a) a.hasOwnProperty(b) && (this[b] = a[b]);
                a.hasOwnProperty("toString") && (this.toString = a.toString)
            },
            clone: function () {
                return this.init.prototype.extend(this)
            }
        },
        B = j.WordArray = m.extend({
            init: function (a, b) {
                a = this.words = a || [];
                this.sigBytes = b != c ? b : 4 * a.length
            },
            toString: function (a) {
                return (a || y).stringify(this)
            },
            concat: function (a) {
                var b = this.words,
                    g = a.words,
                    e = this.sigBytes;
                a = a.sigBytes;
                this.clamp();
                if (e % 4)
                    for (var k = 0; k < a; k++) b[e + k >>> 2] |= (g[k >>> 2] >>> 24 - 8 * (k % 4) & 255) << 24 - 8 * ((e + k) % 4);
                else if (65535 < g.length)
                    for (k = 0; k < a; k += 4) b[e + k >>> 2] = g[k >>> 2];
                else b.push.apply(b, g);
                this.sigBytes += a;
                return this
            },
            clamp: function () {
                var n = this.words,
                    b = this.sigBytes;
                n[b >>> 2] &= 4294967295 <<
                    32 - 8 * (b % 4);
                n.length = a.ceil(b / 4)
            },
            clone: function () {
                var a = m.clone.call(this);
                a.words = this.words.slice(0);
                return a
            },
            random: function (n) {
                for (var b = [], g = 0; g < n; g += 4) b.push(4294967296 * a.random() | 0);
                return new B.init(b, n)
            }
        }),
        v = d.enc = {},
        y = v.Hex = {
            stringify: function (a) {
                var b = a.words;
                a = a.sigBytes;
                for (var g = [], e = 0; e < a; e++) {
                    var k = b[e >>> 2] >>> 24 - 8 * (e % 4) & 255;
                    g.push((k >>> 4).toString(16));
                    g.push((k & 15).toString(16))
                }
                return g.join("")
            },
            parse: function (a) {
                for (var b = a.length, g = [], e = 0; e < b; e += 2) g[e >>> 3] |= parseInt(a.substr(e,
                    2), 16) << 24 - 4 * (e % 8);
                return new B.init(g, b / 2)
            }
        },
        F = v.Latin1 = {
            stringify: function (a) {
                var b = a.words;
                a = a.sigBytes;
                for (var g = [], e = 0; e < a; e++) g.push(String.fromCharCode(b[e >>> 2] >>> 24 - 8 * (e % 4) & 255));
                return g.join("")
            },
            parse: function (a) {
                for (var b = a.length, g = [], e = 0; e < b; e++) g[e >>> 2] |= (a.charCodeAt(e) & 255) << 24 - 8 * (e % 4);
                return new B.init(g, b)
            }
        },
        ha = v.Utf8 = {
            stringify: function (a) {
                try {
                    return decodeURIComponent(escape(F.stringify(a)))
                } catch (b) {
                    throw Error("Malformed UTF-8 data");
                }
            },
            parse: function (a) {
                return F.parse(unescape(encodeURIComponent(a)))
            }
        },
        Z = j.BufferedBlockAlgorithm = m.extend({
            reset: function () {
                this._data = new B.init;
                this._nDataBytes = 0
            },
            _append: function (a) {
                "string" == typeof a && (a = ha.parse(a));
                this._data.concat(a);
                this._nDataBytes += a.sigBytes
            },
            _process: function (n) {
                var b = this._data,
                    g = b.words,
                    e = b.sigBytes,
                    k = this.blockSize,
                    m = e / (4 * k),
                    m = n ? a.ceil(m) : a.max((m | 0) - this._minBufferSize, 0);
                n = m * k;
                e = a.min(4 * n, e);
                if (n) {
                    for (var c = 0; c < n; c += k) this._doProcessBlock(g, c);
                    c = g.splice(0, n);
                    b.sigBytes -= e
                }
                return new B.init(c, e)
            },
            clone: function () {
                var a = m.clone.call(this);
                a._data = this._data.clone();
                return a
            },
            _minBufferSize: 0
        });
    j.Hasher = Z.extend({
        cfg: m.extend(),
        init: function (a) {
            this.cfg = this.cfg.extend(a);
            this.reset()
        },
        reset: function () {
            Z.reset.call(this);
            this._doReset()
        },
        update: function (a) {
            this._append(a);
            this._process();
            return this
        },
        finalize: function (a) {
            a && this._append(a);
            return this._doFinalize()
        },
        blockSize: 16,
        _createHelper: function (a) {
            return function (b, g) {
                return (new a.init(g)).finalize(b)
            }
        },
        _createHmacHelper: function (a) {
            return function (b, g) {
                return (new ia.HMAC.init(a,
                    g)).finalize(b)
            }
        }
    });
    var ia = d.algo = {};
    return d
}(Math);
(function (a) {
    var c = CryptoJS,
        d = c.lib,
        j = d.Base,
        f = d.WordArray,
        c = c.x64 = {};
    c.Word = j.extend({
        init: function (a, c) {
            this.high = a;
            this.low = c
        }
    });
    c.WordArray = j.extend({
        init: function (c, d) {
            c = this.words = c || [];
            this.sigBytes = d != a ? d : 8 * c.length
        },
        toX32: function () {
            for (var a = this.words, c = a.length, d = [], j = 0; j < c; j++) {
                var F = a[j];
                d.push(F.high);
                d.push(F.low)
            }
            return f.create(d, this.sigBytes)
        },
        clone: function () {
            for (var a = j.clone.call(this), c = a.words = this.words.slice(0), d = c.length, f = 0; f < d; f++) c[f] = c[f].clone();
            return a
        }
    })
})();
(function () {
    function a() {
        return f.create.apply(f, arguments)
    }
    for (var c = CryptoJS, d = c.lib.Hasher, j = c.x64, f = j.Word, m = j.WordArray, j = c.algo, B = [a(1116352408, 3609767458), a(1899447441, 602891725), a(3049323471, 3964484399), a(3921009573, 2173295548), a(961987163, 4081628472), a(1508970993, 3053834265), a(2453635748, 2937671579), a(2870763221, 3664609560), a(3624381080, 2734883394), a(310598401, 1164996542), a(607225278, 1323610764), a(1426881987, 3590304994), a(1925078388, 4068182383), a(2162078206, 991336113), a(2614888103, 633803317),
            a(3248222580, 3479774868), a(3835390401, 2666613458), a(4022224774, 944711139), a(264347078, 2341262773), a(604807628, 2007800933), a(770255983, 1495990901), a(1249150122, 1856431235), a(1555081692, 3175218132), a(1996064986, 2198950837), a(2554220882, 3999719339), a(2821834349, 766784016), a(2952996808, 2566594879), a(3210313671, 3203337956), a(3336571891, 1034457026), a(3584528711, 2466948901), a(113926993, 3758326383), a(338241895, 168717936), a(666307205, 1188179964), a(773529912, 1546045734), a(1294757372, 1522805485), a(1396182291,
                2643833823), a(1695183700, 2343527390), a(1986661051, 1014477480), a(2177026350, 1206759142), a(2456956037, 344077627), a(2730485921, 1290863460), a(2820302411, 3158454273), a(3259730800, 3505952657), a(3345764771, 106217008), a(3516065817, 3606008344), a(3600352804, 1432725776), a(4094571909, 1467031594), a(275423344, 851169720), a(430227734, 3100823752), a(506948616, 1363258195), a(659060556, 3750685593), a(883997877, 3785050280), a(958139571, 3318307427), a(1322822218, 3812723403), a(1537002063, 2003034995), a(1747873779, 3602036899),
            a(1955562222, 1575990012), a(2024104815, 1125592928), a(2227730452, 2716904306), a(2361852424, 442776044), a(2428436474, 593698344), a(2756734187, 3733110249), a(3204031479, 2999351573), a(3329325298, 3815920427), a(3391569614, 3928383900), a(3515267271, 566280711), a(3940187606, 3454069534), a(4118630271, 4000239992), a(116418474, 1914138554), a(174292421, 2731055270), a(289380356, 3203993006), a(460393269, 320620315), a(685471733, 587496836), a(852142971, 1086792851), a(1017036298, 365543100), a(1126000580, 2618297676), a(1288033470,
                3409855158), a(1501505948, 4234509866), a(1607167915, 987167468), a(1816402316, 1246189591)
        ], v = [], y = 0; 80 > y; y++) v[y] = a();
    j = j.SHA512 = d.extend({
        _doReset: function () {
            this._hash = new m.init([new f.init(1779033703, 4089235720), new f.init(3144134277, 2227873595), new f.init(1013904242, 4271175723), new f.init(2773480762, 1595750129), new f.init(1359893119, 2917565137), new f.init(2600822924, 725511199), new f.init(528734635, 4215389547), new f.init(1541459225, 327033209)])
        },
        _doProcessBlock: function (a, c) {
            for (var d = this._hash.words,
                    f = d[0], j = d[1], b = d[2], g = d[3], e = d[4], k = d[5], m = d[6], d = d[7], y = f.high, M = f.low, $ = j.high, N = j.low, aa = b.high, O = b.low, ba = g.high, P = g.low, ca = e.high, Q = e.low, da = k.high, R = k.low, ea = m.high, S = m.low, fa = d.high, T = d.low, s = y, p = M, G = $, D = N, H = aa, E = O, W = ba, I = P, t = ca, q = Q, U = da, J = R, V = ea, K = S, X = fa, L = T, u = 0; 80 > u; u++) {
                var z = v[u];
                if (16 > u) var r = z.high = a[c + 2 * u] | 0,
                    h = z.low = a[c + 2 * u + 1] | 0;
                else {
                    var r = v[u - 15],
                        h = r.high,
                        w = r.low,
                        r = (h >>> 1 | w << 31) ^ (h >>> 8 | w << 24) ^ h >>> 7,
                        w = (w >>> 1 | h << 31) ^ (w >>> 8 | h << 24) ^ (w >>> 7 | h << 25),
                        C = v[u - 2],
                        h = C.high,
                        l = C.low,
                        C = (h >>> 19 | l <<
                            13) ^ (h << 3 | l >>> 29) ^ h >>> 6,
                        l = (l >>> 19 | h << 13) ^ (l << 3 | h >>> 29) ^ (l >>> 6 | h << 26),
                        h = v[u - 7],
                        Y = h.high,
                        A = v[u - 16],
                        x = A.high,
                        A = A.low,
                        h = w + h.low,
                        r = r + Y + (h >>> 0 < w >>> 0 ? 1 : 0),
                        h = h + l,
                        r = r + C + (h >>> 0 < l >>> 0 ? 1 : 0),
                        h = h + A,
                        r = r + x + (h >>> 0 < A >>> 0 ? 1 : 0);
                    z.high = r;
                    z.low = h
                }
                var Y = t & U ^ ~t & V,
                    A = q & J ^ ~q & K,
                    z = s & G ^ s & H ^ G & H,
                    ja = p & D ^ p & E ^ D & E,
                    w = (s >>> 28 | p << 4) ^ (s << 30 | p >>> 2) ^ (s << 25 | p >>> 7),
                    C = (p >>> 28 | s << 4) ^ (p << 30 | s >>> 2) ^ (p << 25 | s >>> 7),
                    l = B[u],
                    ka = l.high,
                    ga = l.low,
                    l = L + ((q >>> 14 | t << 18) ^ (q >>> 18 | t << 14) ^ (q << 23 | t >>> 9)),
                    x = X + ((t >>> 14 | q << 18) ^ (t >>> 18 | q << 14) ^ (t << 23 | q >>> 9)) + (l >>> 0 <
                        L >>> 0 ? 1 : 0),
                    l = l + A,
                    x = x + Y + (l >>> 0 < A >>> 0 ? 1 : 0),
                    l = l + ga,
                    x = x + ka + (l >>> 0 < ga >>> 0 ? 1 : 0),
                    l = l + h,
                    x = x + r + (l >>> 0 < h >>> 0 ? 1 : 0),
                    h = C + ja,
                    z = w + z + (h >>> 0 < C >>> 0 ? 1 : 0),
                    X = V,
                    L = K,
                    V = U,
                    K = J,
                    U = t,
                    J = q,
                    q = I + l | 0,
                    t = W + x + (q >>> 0 < I >>> 0 ? 1 : 0) | 0,
                    W = H,
                    I = E,
                    H = G,
                    E = D,
                    G = s,
                    D = p,
                    p = l + h | 0,
                    s = x + z + (p >>> 0 < l >>> 0 ? 1 : 0) | 0
            }
            M = f.low = M + p;
            f.high = y + s + (M >>> 0 < p >>> 0 ? 1 : 0);
            N = j.low = N + D;
            j.high = $ + G + (N >>> 0 < D >>> 0 ? 1 : 0);
            O = b.low = O + E;
            b.high = aa + H + (O >>> 0 < E >>> 0 ? 1 : 0);
            P = g.low = P + I;
            g.high = ba + W + (P >>> 0 < I >>> 0 ? 1 : 0);
            Q = e.low = Q + q;
            e.high = ca + t + (Q >>> 0 < q >>> 0 ? 1 : 0);
            R = k.low = R + J;
            k.high = da + U + (R >>> 0 < J >>> 0 ? 1 : 0);
            S = m.low = S + K;
            m.high = ea + V + (S >>> 0 < K >>> 0 ? 1 : 0);
            T = d.low = T + L;
            d.high = fa + X + (T >>> 0 < L >>> 0 ? 1 : 0)
        },
        _doFinalize: function () {
            var a = this._data,
                c = a.words,
                d = 8 * this._nDataBytes,
                f = 8 * a.sigBytes;
            c[f >>> 5] |= 128 << 24 - f % 32;
            c[(f + 128 >>> 10 << 5) + 30] = Math.floor(d / 4294967296);
            c[(f + 128 >>> 10 << 5) + 31] = d;
            a.sigBytes = 4 * c.length;
            this._process();
            return this._hash.toX32()
        },
        clone: function () {
            var a = d.clone.call(this);
            a._hash = this._hash.clone();
            return a
        },
        blockSize: 32
    });
    c.SHA512 = d._createHelper(j);
    c.HmacSHA512 = d._createHmacHelper(j)
})();
(function () {
    var a = CryptoJS,
        c = a.x64,
        d = c.Word,
        j = c.WordArray,
        c = a.algo,
        f = c.SHA512,
        c = c.SHA384 = f.extend({
            _doReset: function () {
                this._hash = new j.init([new d.init(3418070365, 3238371032), new d.init(1654270250, 914150663), new d.init(2438529370, 812702999), new d.init(355462360, 4144912697), new d.init(1731405415, 4290775857), new d.init(2394180231, 1750603025), new d.init(3675008525, 1694076839), new d.init(1203062813, 3204075428)])
            },
            _doFinalize: function () {
                var a = f._doFinalize.call(this);
                a.sigBytes -= 16;
                return a
            }
        });
    a.SHA384 =
        f._createHelper(c);
    a.HmacSHA384 = f._createHmacHelper(c)
})();
var CryptoJS = CryptoJS || function (a, m) {
    var r = {},
        f = r.lib = {},
        g = function () {},
        l = f.Base = {
            extend: function (a) {
                g.prototype = this;
                var b = new g;
                a && b.mixIn(a);
                b.hasOwnProperty("init") || (b.init = function () {
                    b.$super.init.apply(this, arguments)
                });
                b.init.prototype = b;
                b.$super = this;
                return b
            },
            create: function () {
                var a = this.extend();
                a.init.apply(a, arguments);
                return a
            },
            init: function () {},
            mixIn: function (a) {
                for (var b in a) a.hasOwnProperty(b) && (this[b] = a[b]);
                a.hasOwnProperty("toString") && (this.toString = a.toString)
            },
            clone: function () {
                return this.init.prototype.extend(this)
            }
        },
        p = f.WordArray = l.extend({
            init: function (a, b) {
                a = this.words = a || [];
                this.sigBytes = b != m ? b : 4 * a.length
            },
            toString: function (a) {
                return (a || q).stringify(this)
            },
            concat: function (a) {
                var b = this.words,
                    d = a.words,
                    c = this.sigBytes;
                a = a.sigBytes;
                this.clamp();
                if (c % 4)
                    for (var j = 0; j < a; j++) b[c + j >>> 2] |= (d[j >>> 2] >>> 24 - 8 * (j % 4) & 255) << 24 - 8 * ((c + j) % 4);
                else if (65535 < d.length)
                    for (j = 0; j < a; j += 4) b[c + j >>> 2] = d[j >>> 2];
                else b.push.apply(b, d);
                this.sigBytes += a;
                return this
            },
            clamp: function () {
                var n = this.words,
                    b = this.sigBytes;
                n[b >>> 2] &= 4294967295 <<
                    32 - 8 * (b % 4);
                n.length = a.ceil(b / 4)
            },
            clone: function () {
                var a = l.clone.call(this);
                a.words = this.words.slice(0);
                return a
            },
            random: function (n) {
                for (var b = [], d = 0; d < n; d += 4) b.push(4294967296 * a.random() | 0);
                return new p.init(b, n)
            }
        }),
        y = r.enc = {},
        q = y.Hex = {
            stringify: function (a) {
                var b = a.words;
                a = a.sigBytes;
                for (var d = [], c = 0; c < a; c++) {
                    var j = b[c >>> 2] >>> 24 - 8 * (c % 4) & 255;
                    d.push((j >>> 4).toString(16));
                    d.push((j & 15).toString(16))
                }
                return d.join("")
            },
            parse: function (a) {
                for (var b = a.length, d = [], c = 0; c < b; c += 2) d[c >>> 3] |= parseInt(a.substr(c,
                    2), 16) << 24 - 4 * (c % 8);
                return new p.init(d, b / 2)
            }
        },
        G = y.Latin1 = {
            stringify: function (a) {
                var b = a.words;
                a = a.sigBytes;
                for (var d = [], c = 0; c < a; c++) d.push(String.fromCharCode(b[c >>> 2] >>> 24 - 8 * (c % 4) & 255));
                return d.join("")
            },
            parse: function (a) {
                for (var b = a.length, d = [], c = 0; c < b; c++) d[c >>> 2] |= (a.charCodeAt(c) & 255) << 24 - 8 * (c % 4);
                return new p.init(d, b)
            }
        },
        fa = y.Utf8 = {
            stringify: function (a) {
                try {
                    return decodeURIComponent(escape(G.stringify(a)))
                } catch (b) {
                    throw Error("Malformed UTF-8 data");
                }
            },
            parse: function (a) {
                return G.parse(unescape(encodeURIComponent(a)))
            }
        },
        h = f.BufferedBlockAlgorithm = l.extend({
            reset: function () {
                this._data = new p.init;
                this._nDataBytes = 0
            },
            _append: function (a) {
                "string" == typeof a && (a = fa.parse(a));
                this._data.concat(a);
                this._nDataBytes += a.sigBytes
            },
            _process: function (n) {
                var b = this._data,
                    d = b.words,
                    c = b.sigBytes,
                    j = this.blockSize,
                    l = c / (4 * j),
                    l = n ? a.ceil(l) : a.max((l | 0) - this._minBufferSize, 0);
                n = l * j;
                c = a.min(4 * n, c);
                if (n) {
                    for (var h = 0; h < n; h += j) this._doProcessBlock(d, h);
                    h = d.splice(0, n);
                    b.sigBytes -= c
                }
                return new p.init(h, c)
            },
            clone: function () {
                var a = l.clone.call(this);
                a._data = this._data.clone();
                return a
            },
            _minBufferSize: 0
        });
    f.Hasher = h.extend({
        cfg: l.extend(),
        init: function (a) {
            this.cfg = this.cfg.extend(a);
            this.reset()
        },
        reset: function () {
            h.reset.call(this);
            this._doReset()
        },
        update: function (a) {
            this._append(a);
            this._process();
            return this
        },
        finalize: function (a) {
            a && this._append(a);
            return this._doFinalize()
        },
        blockSize: 16,
        _createHelper: function (a) {
            return function (b, d) {
                return (new a.init(d)).finalize(b)
            }
        },
        _createHmacHelper: function (a) {
            return function (b, d) {
                return (new ga.HMAC.init(a,
                    d)).finalize(b)
            }
        }
    });
    var ga = r.algo = {};
    return r
}(Math);
(function (a) {
    var m = CryptoJS,
        r = m.lib,
        f = r.Base,
        g = r.WordArray,
        m = m.x64 = {};
    m.Word = f.extend({
        init: function (a, p) {
            this.high = a;
            this.low = p
        }
    });
    m.WordArray = f.extend({
        init: function (l, p) {
            l = this.words = l || [];
            this.sigBytes = p != a ? p : 8 * l.length
        },
        toX32: function () {
            for (var a = this.words, p = a.length, f = [], q = 0; q < p; q++) {
                var G = a[q];
                f.push(G.high);
                f.push(G.low)
            }
            return g.create(f, this.sigBytes)
        },
        clone: function () {
            for (var a = f.clone.call(this), p = a.words = this.words.slice(0), g = p.length, q = 0; q < g; q++) p[q] = p[q].clone();
            return a
        }
    })
})();
(function () {
    function a() {
        return g.create.apply(g, arguments)
    }
    for (var m = CryptoJS, r = m.lib.Hasher, f = m.x64, g = f.Word, l = f.WordArray, f = m.algo, p = [a(1116352408, 3609767458), a(1899447441, 602891725), a(3049323471, 3964484399), a(3921009573, 2173295548), a(961987163, 4081628472), a(1508970993, 3053834265), a(2453635748, 2937671579), a(2870763221, 3664609560), a(3624381080, 2734883394), a(310598401, 1164996542), a(607225278, 1323610764), a(1426881987, 3590304994), a(1925078388, 4068182383), a(2162078206, 991336113), a(2614888103, 633803317),
            a(3248222580, 3479774868), a(3835390401, 2666613458), a(4022224774, 944711139), a(264347078, 2341262773), a(604807628, 2007800933), a(770255983, 1495990901), a(1249150122, 1856431235), a(1555081692, 3175218132), a(1996064986, 2198950837), a(2554220882, 3999719339), a(2821834349, 766784016), a(2952996808, 2566594879), a(3210313671, 3203337956), a(3336571891, 1034457026), a(3584528711, 2466948901), a(113926993, 3758326383), a(338241895, 168717936), a(666307205, 1188179964), a(773529912, 1546045734), a(1294757372, 1522805485), a(1396182291,
                2643833823), a(1695183700, 2343527390), a(1986661051, 1014477480), a(2177026350, 1206759142), a(2456956037, 344077627), a(2730485921, 1290863460), a(2820302411, 3158454273), a(3259730800, 3505952657), a(3345764771, 106217008), a(3516065817, 3606008344), a(3600352804, 1432725776), a(4094571909, 1467031594), a(275423344, 851169720), a(430227734, 3100823752), a(506948616, 1363258195), a(659060556, 3750685593), a(883997877, 3785050280), a(958139571, 3318307427), a(1322822218, 3812723403), a(1537002063, 2003034995), a(1747873779, 3602036899),
            a(1955562222, 1575990012), a(2024104815, 1125592928), a(2227730452, 2716904306), a(2361852424, 442776044), a(2428436474, 593698344), a(2756734187, 3733110249), a(3204031479, 2999351573), a(3329325298, 3815920427), a(3391569614, 3928383900), a(3515267271, 566280711), a(3940187606, 3454069534), a(4118630271, 4000239992), a(116418474, 1914138554), a(174292421, 2731055270), a(289380356, 3203993006), a(460393269, 320620315), a(685471733, 587496836), a(852142971, 1086792851), a(1017036298, 365543100), a(1126000580, 2618297676), a(1288033470,
                3409855158), a(1501505948, 4234509866), a(1607167915, 987167468), a(1816402316, 1246189591)
        ], y = [], q = 0; 80 > q; q++) y[q] = a();
    f = f.SHA512 = r.extend({
        _doReset: function () {
            this._hash = new l.init([new g.init(1779033703, 4089235720), new g.init(3144134277, 2227873595), new g.init(1013904242, 4271175723), new g.init(2773480762, 1595750129), new g.init(1359893119, 2917565137), new g.init(2600822924, 725511199), new g.init(528734635, 4215389547), new g.init(1541459225, 327033209)])
        },
        _doProcessBlock: function (a, f) {
            for (var h = this._hash.words,
                    g = h[0], n = h[1], b = h[2], d = h[3], c = h[4], j = h[5], l = h[6], h = h[7], q = g.high, m = g.low, r = n.high, N = n.low, Z = b.high, O = b.low, $ = d.high, P = d.low, aa = c.high, Q = c.low, ba = j.high, R = j.low, ca = l.high, S = l.low, da = h.high, T = h.low, v = q, s = m, H = r, E = N, I = Z, F = O, W = $, J = P, w = aa, t = Q, U = ba, K = R, V = ca, L = S, X = da, M = T, x = 0; 80 > x; x++) {
                var B = y[x];
                if (16 > x) var u = B.high = a[f + 2 * x] | 0,
                    e = B.low = a[f + 2 * x + 1] | 0;
                else {
                    var u = y[x - 15],
                        e = u.high,
                        z = u.low,
                        u = (e >>> 1 | z << 31) ^ (e >>> 8 | z << 24) ^ e >>> 7,
                        z = (z >>> 1 | e << 31) ^ (z >>> 8 | e << 24) ^ (z >>> 7 | e << 25),
                        D = y[x - 2],
                        e = D.high,
                        k = D.low,
                        D = (e >>> 19 | k << 13) ^
                        (e << 3 | k >>> 29) ^ e >>> 6,
                        k = (k >>> 19 | e << 13) ^ (k << 3 | e >>> 29) ^ (k >>> 6 | e << 26),
                        e = y[x - 7],
                        Y = e.high,
                        C = y[x - 16],
                        A = C.high,
                        C = C.low,
                        e = z + e.low,
                        u = u + Y + (e >>> 0 < z >>> 0 ? 1 : 0),
                        e = e + k,
                        u = u + D + (e >>> 0 < k >>> 0 ? 1 : 0),
                        e = e + C,
                        u = u + A + (e >>> 0 < C >>> 0 ? 1 : 0);
                    B.high = u;
                    B.low = e
                }
                var Y = w & U ^ ~w & V,
                    C = t & K ^ ~t & L,
                    B = v & H ^ v & I ^ H & I,
                    ha = s & E ^ s & F ^ E & F,
                    z = (v >>> 28 | s << 4) ^ (v << 30 | s >>> 2) ^ (v << 25 | s >>> 7),
                    D = (s >>> 28 | v << 4) ^ (s << 30 | v >>> 2) ^ (s << 25 | v >>> 7),
                    k = p[x],
                    ia = k.high,
                    ea = k.low,
                    k = M + ((t >>> 14 | w << 18) ^ (t >>> 18 | w << 14) ^ (t << 23 | w >>> 9)),
                    A = X + ((w >>> 14 | t << 18) ^ (w >>> 18 | t << 14) ^ (w << 23 | t >>> 9)) + (k >>> 0 < M >>>
                        0 ? 1 : 0),
                    k = k + C,
                    A = A + Y + (k >>> 0 < C >>> 0 ? 1 : 0),
                    k = k + ea,
                    A = A + ia + (k >>> 0 < ea >>> 0 ? 1 : 0),
                    k = k + e,
                    A = A + u + (k >>> 0 < e >>> 0 ? 1 : 0),
                    e = D + ha,
                    B = z + B + (e >>> 0 < D >>> 0 ? 1 : 0),
                    X = V,
                    M = L,
                    V = U,
                    L = K,
                    U = w,
                    K = t,
                    t = J + k | 0,
                    w = W + A + (t >>> 0 < J >>> 0 ? 1 : 0) | 0,
                    W = I,
                    J = F,
                    I = H,
                    F = E,
                    H = v,
                    E = s,
                    s = k + e | 0,
                    v = A + B + (s >>> 0 < k >>> 0 ? 1 : 0) | 0
            }
            m = g.low = m + s;
            g.high = q + v + (m >>> 0 < s >>> 0 ? 1 : 0);
            N = n.low = N + E;
            n.high = r + H + (N >>> 0 < E >>> 0 ? 1 : 0);
            O = b.low = O + F;
            b.high = Z + I + (O >>> 0 < F >>> 0 ? 1 : 0);
            P = d.low = P + J;
            d.high = $ + W + (P >>> 0 < J >>> 0 ? 1 : 0);
            Q = c.low = Q + t;
            c.high = aa + w + (Q >>> 0 < t >>> 0 ? 1 : 0);
            R = j.low = R + K;
            j.high = ba + U + (R >>> 0 < K >>> 0 ? 1 : 0);
            S = l.low =
                S + L;
            l.high = ca + V + (S >>> 0 < L >>> 0 ? 1 : 0);
            T = h.low = T + M;
            h.high = da + X + (T >>> 0 < M >>> 0 ? 1 : 0)
        },
        _doFinalize: function () {
            var a = this._data,
                f = a.words,
                h = 8 * this._nDataBytes,
                g = 8 * a.sigBytes;
            f[g >>> 5] |= 128 << 24 - g % 32;
            f[(g + 128 >>> 10 << 5) + 30] = Math.floor(h / 4294967296);
            f[(g + 128 >>> 10 << 5) + 31] = h;
            a.sigBytes = 4 * f.length;
            this._process();
            return this._hash.toX32()
        },
        clone: function () {
            var a = r.clone.call(this);
            a._hash = this._hash.clone();
            return a
        },
        blockSize: 32
    });
    m.SHA512 = r._createHelper(f);
    m.HmacSHA512 = r._createHmacHelper(f)
})();
(function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var BlockCipher = C_lib.BlockCipher;
    var C_algo = C.algo;

    const N = 16;
    
    //Origin pbox and sbox, derived from PI
    const ORIG_P = [
        0x243F6A88, 0x85A308D3, 0x13198A2E, 0x03707344,
        0xA4093822, 0x299F31D0, 0x082EFA98, 0xEC4E6C89,
        0x452821E6, 0x38D01377, 0xBE5466CF, 0x34E90C6C,
        0xC0AC29B7, 0xC97C50DD, 0x3F84D5B5, 0xB5470917,
        0x9216D5D9, 0x8979FB1B
    ];

    const ORIG_S = [
        [   0xD1310BA6, 0x98DFB5AC, 0x2FFD72DB, 0xD01ADFB7,
            0xB8E1AFED, 0x6A267E96, 0xBA7C9045, 0xF12C7F99,
            0x24A19947, 0xB3916CF7, 0x0801F2E2, 0x858EFC16,
            0x636920D8, 0x71574E69, 0xA458FEA3, 0xF4933D7E,
            0x0D95748F, 0x728EB658, 0x718BCD58, 0x82154AEE,
            0x7B54A41D, 0xC25A59B5, 0x9C30D539, 0x2AF26013,
            0xC5D1B023, 0x286085F0, 0xCA417918, 0xB8DB38EF,
            0x8E79DCB0, 0x603A180E, 0x6C9E0E8B, 0xB01E8A3E,
            0xD71577C1, 0xBD314B27, 0x78AF2FDA, 0x55605C60,
            0xE65525F3, 0xAA55AB94, 0x57489862, 0x63E81440,
            0x55CA396A, 0x2AAB10B6, 0xB4CC5C34, 0x1141E8CE,
            0xA15486AF, 0x7C72E993, 0xB3EE1411, 0x636FBC2A,
            0x2BA9C55D, 0x741831F6, 0xCE5C3E16, 0x9B87931E,
            0xAFD6BA33, 0x6C24CF5C, 0x7A325381, 0x28958677,
            0x3B8F4898, 0x6B4BB9AF, 0xC4BFE81B, 0x66282193,
            0x61D809CC, 0xFB21A991, 0x487CAC60, 0x5DEC8032,
            0xEF845D5D, 0xE98575B1, 0xDC262302, 0xEB651B88,
            0x23893E81, 0xD396ACC5, 0x0F6D6FF3, 0x83F44239,
            0x2E0B4482, 0xA4842004, 0x69C8F04A, 0x9E1F9B5E,
            0x21C66842, 0xF6E96C9A, 0x670C9C61, 0xABD388F0,
            0x6A51A0D2, 0xD8542F68, 0x960FA728, 0xAB5133A3,
            0x6EEF0B6C, 0x137A3BE4, 0xBA3BF050, 0x7EFB2A98,
            0xA1F1651D, 0x39AF0176, 0x66CA593E, 0x82430E88,
            0x8CEE8619, 0x456F9FB4, 0x7D84A5C3, 0x3B8B5EBE,
            0xE06F75D8, 0x85C12073, 0x401A449F, 0x56C16AA6,
            0x4ED3AA62, 0x363F7706, 0x1BFEDF72, 0x429B023D,
            0x37D0D724, 0xD00A1248, 0xDB0FEAD3, 0x49F1C09B,
            0x075372C9, 0x80991B7B, 0x25D479D8, 0xF6E8DEF7,
            0xE3FE501A, 0xB6794C3B, 0x976CE0BD, 0x04C006BA,
            0xC1A94FB6, 0x409F60C4, 0x5E5C9EC2, 0x196A2463,
            0x68FB6FAF, 0x3E6C53B5, 0x1339B2EB, 0x3B52EC6F,
            0x6DFC511F, 0x9B30952C, 0xCC814544, 0xAF5EBD09,
            0xBEE3D004, 0xDE334AFD, 0x660F2807, 0x192E4BB3,
            0xC0CBA857, 0x45C8740F, 0xD20B5F39, 0xB9D3FBDB,
            0x5579C0BD, 0x1A60320A, 0xD6A100C6, 0x402C7279,
            0x679F25FE, 0xFB1FA3CC, 0x8EA5E9F8, 0xDB3222F8,
            0x3C7516DF, 0xFD616B15, 0x2F501EC8, 0xAD0552AB,
            0x323DB5FA, 0xFD238760, 0x53317B48, 0x3E00DF82,
            0x9E5C57BB, 0xCA6F8CA0, 0x1A87562E, 0xDF1769DB,
            0xD542A8F6, 0x287EFFC3, 0xAC6732C6, 0x8C4F5573,
            0x695B27B0, 0xBBCA58C8, 0xE1FFA35D, 0xB8F011A0,
            0x10FA3D98, 0xFD2183B8, 0x4AFCB56C, 0x2DD1D35B,
            0x9A53E479, 0xB6F84565, 0xD28E49BC, 0x4BFB9790,
            0xE1DDF2DA, 0xA4CB7E33, 0x62FB1341, 0xCEE4C6E8,
            0xEF20CADA, 0x36774C01, 0xD07E9EFE, 0x2BF11FB4,
            0x95DBDA4D, 0xAE909198, 0xEAAD8E71, 0x6B93D5A0,
            0xD08ED1D0, 0xAFC725E0, 0x8E3C5B2F, 0x8E7594B7,
            0x8FF6E2FB, 0xF2122B64, 0x8888B812, 0x900DF01C,
            0x4FAD5EA0, 0x688FC31C, 0xD1CFF191, 0xB3A8C1AD,
            0x2F2F2218, 0xBE0E1777, 0xEA752DFE, 0x8B021FA1,
            0xE5A0CC0F, 0xB56F74E8, 0x18ACF3D6, 0xCE89E299,
            0xB4A84FE0, 0xFD13E0B7, 0x7CC43B81, 0xD2ADA8D9,
            0x165FA266, 0x80957705, 0x93CC7314, 0x211A1477,
            0xE6AD2065, 0x77B5FA86, 0xC75442F5, 0xFB9D35CF,
            0xEBCDAF0C, 0x7B3E89A0, 0xD6411BD3, 0xAE1E7E49,
            0x00250E2D, 0x2071B35E, 0x226800BB, 0x57B8E0AF,
            0x2464369B, 0xF009B91E, 0x5563911D, 0x59DFA6AA,
            0x78C14389, 0xD95A537F, 0x207D5BA2, 0x02E5B9C5,
            0x83260376, 0x6295CFA9, 0x11C81968, 0x4E734A41,
            0xB3472DCA, 0x7B14A94A, 0x1B510052, 0x9A532915,
            0xD60F573F, 0xBC9BC6E4, 0x2B60A476, 0x81E67400,
            0x08BA6FB5, 0x571BE91F, 0xF296EC6B, 0x2A0DD915,
            0xB6636521, 0xE7B9F9B6, 0xFF34052E, 0xC5855664,
            0x53B02D5D, 0xA99F8FA1, 0x08BA4799, 0x6E85076A   ],
        [   0x4B7A70E9, 0xB5B32944, 0xDB75092E, 0xC4192623,
            0xAD6EA6B0, 0x49A7DF7D, 0x9CEE60B8, 0x8FEDB266,
            0xECAA8C71, 0x699A17FF, 0x5664526C, 0xC2B19EE1,
            0x193602A5, 0x75094C29, 0xA0591340, 0xE4183A3E,
            0x3F54989A, 0x5B429D65, 0x6B8FE4D6, 0x99F73FD6,
            0xA1D29C07, 0xEFE830F5, 0x4D2D38E6, 0xF0255DC1,
            0x4CDD2086, 0x8470EB26, 0x6382E9C6, 0x021ECC5E,
            0x09686B3F, 0x3EBAEFC9, 0x3C971814, 0x6B6A70A1,
            0x687F3584, 0x52A0E286, 0xB79C5305, 0xAA500737,
            0x3E07841C, 0x7FDEAE5C, 0x8E7D44EC, 0x5716F2B8,
            0xB03ADA37, 0xF0500C0D, 0xF01C1F04, 0x0200B3FF,
            0xAE0CF51A, 0x3CB574B2, 0x25837A58, 0xDC0921BD,
            0xD19113F9, 0x7CA92FF6, 0x94324773, 0x22F54701,
            0x3AE5E581, 0x37C2DADC, 0xC8B57634, 0x9AF3DDA7,
            0xA9446146, 0x0FD0030E, 0xECC8C73E, 0xA4751E41,
            0xE238CD99, 0x3BEA0E2F, 0x3280BBA1, 0x183EB331,
            0x4E548B38, 0x4F6DB908, 0x6F420D03, 0xF60A04BF,
            0x2CB81290, 0x24977C79, 0x5679B072, 0xBCAF89AF,
            0xDE9A771F, 0xD9930810, 0xB38BAE12, 0xDCCF3F2E,
            0x5512721F, 0x2E6B7124, 0x501ADDE6, 0x9F84CD87,
            0x7A584718, 0x7408DA17, 0xBC9F9ABC, 0xE94B7D8C,
            0xEC7AEC3A, 0xDB851DFA, 0x63094366, 0xC464C3D2,
            0xEF1C1847, 0x3215D908, 0xDD433B37, 0x24C2BA16,
            0x12A14D43, 0x2A65C451, 0x50940002, 0x133AE4DD,
            0x71DFF89E, 0x10314E55, 0x81AC77D6, 0x5F11199B,
            0x043556F1, 0xD7A3C76B, 0x3C11183B, 0x5924A509,
            0xF28FE6ED, 0x97F1FBFA, 0x9EBABF2C, 0x1E153C6E,
            0x86E34570, 0xEAE96FB1, 0x860E5E0A, 0x5A3E2AB3,
            0x771FE71C, 0x4E3D06FA, 0x2965DCB9, 0x99E71D0F,
            0x803E89D6, 0x5266C825, 0x2E4CC978, 0x9C10B36A,
            0xC6150EBA, 0x94E2EA78, 0xA5FC3C53, 0x1E0A2DF4,
            0xF2F74EA7, 0x361D2B3D, 0x1939260F, 0x19C27960,
            0x5223A708, 0xF71312B6, 0xEBADFE6E, 0xEAC31F66,
            0xE3BC4595, 0xA67BC883, 0xB17F37D1, 0x018CFF28,
            0xC332DDEF, 0xBE6C5AA5, 0x65582185, 0x68AB9802,
            0xEECEA50F, 0xDB2F953B, 0x2AEF7DAD, 0x5B6E2F84,
            0x1521B628, 0x29076170, 0xECDD4775, 0x619F1510,
            0x13CCA830, 0xEB61BD96, 0x0334FE1E, 0xAA0363CF,
            0xB5735C90, 0x4C70A239, 0xD59E9E0B, 0xCBAADE14,
            0xEECC86BC, 0x60622CA7, 0x9CAB5CAB, 0xB2F3846E,
            0x648B1EAF, 0x19BDF0CA, 0xA02369B9, 0x655ABB50,
            0x40685A32, 0x3C2AB4B3, 0x319EE9D5, 0xC021B8F7,
            0x9B540B19, 0x875FA099, 0x95F7997E, 0x623D7DA8,
            0xF837889A, 0x97E32D77, 0x11ED935F, 0x16681281,
            0x0E358829, 0xC7E61FD6, 0x96DEDFA1, 0x7858BA99,
            0x57F584A5, 0x1B227263, 0x9B83C3FF, 0x1AC24696,
            0xCDB30AEB, 0x532E3054, 0x8FD948E4, 0x6DBC3128,
            0x58EBF2EF, 0x34C6FFEA, 0xFE28ED61, 0xEE7C3C73,
            0x5D4A14D9, 0xE864B7E3, 0x42105D14, 0x203E13E0,
            0x45EEE2B6, 0xA3AAABEA, 0xDB6C4F15, 0xFACB4FD0,
            0xC742F442, 0xEF6ABBB5, 0x654F3B1D, 0x41CD2105,
            0xD81E799E, 0x86854DC7, 0xE44B476A, 0x3D816250,
            0xCF62A1F2, 0x5B8D2646, 0xFC8883A0, 0xC1C7B6A3,
            0x7F1524C3, 0x69CB7492, 0x47848A0B, 0x5692B285,
            0x095BBF00, 0xAD19489D, 0x1462B174, 0x23820E00,
            0x58428D2A, 0x0C55F5EA, 0x1DADF43E, 0x233F7061,
            0x3372F092, 0x8D937E41, 0xD65FECF1, 0x6C223BDB,
            0x7CDE3759, 0xCBEE7460, 0x4085F2A7, 0xCE77326E,
            0xA6078084, 0x19F8509E, 0xE8EFD855, 0x61D99735,
            0xA969A7AA, 0xC50C06C2, 0x5A04ABFC, 0x800BCADC,
            0x9E447A2E, 0xC3453484, 0xFDD56705, 0x0E1E9EC9,
            0xDB73DBD3, 0x105588CD, 0x675FDA79, 0xE3674340,
            0xC5C43465, 0x713E38D8, 0x3D28F89E, 0xF16DFF20,
            0x153E21E7, 0x8FB03D4A, 0xE6E39F2B, 0xDB83ADF7   ],
        [   0xE93D5A68, 0x948140F7, 0xF64C261C, 0x94692934,
            0x411520F7, 0x7602D4F7, 0xBCF46B2E, 0xD4A20068,
            0xD4082471, 0x3320F46A, 0x43B7D4B7, 0x500061AF,
            0x1E39F62E, 0x97244546, 0x14214F74, 0xBF8B8840,
            0x4D95FC1D, 0x96B591AF, 0x70F4DDD3, 0x66A02F45,
            0xBFBC09EC, 0x03BD9785, 0x7FAC6DD0, 0x31CB8504,
            0x96EB27B3, 0x55FD3941, 0xDA2547E6, 0xABCA0A9A,
            0x28507825, 0x530429F4, 0x0A2C86DA, 0xE9B66DFB,
            0x68DC1462, 0xD7486900, 0x680EC0A4, 0x27A18DEE,
            0x4F3FFEA2, 0xE887AD8C, 0xB58CE006, 0x7AF4D6B6,
            0xAACE1E7C, 0xD3375FEC, 0xCE78A399, 0x406B2A42,
            0x20FE9E35, 0xD9F385B9, 0xEE39D7AB, 0x3B124E8B,
            0x1DC9FAF7, 0x4B6D1856, 0x26A36631, 0xEAE397B2,
            0x3A6EFA74, 0xDD5B4332, 0x6841E7F7, 0xCA7820FB,
            0xFB0AF54E, 0xD8FEB397, 0x454056AC, 0xBA489527,
            0x55533A3A, 0x20838D87, 0xFE6BA9B7, 0xD096954B,
            0x55A867BC, 0xA1159A58, 0xCCA92963, 0x99E1DB33,
            0xA62A4A56, 0x3F3125F9, 0x5EF47E1C, 0x9029317C,
            0xFDF8E802, 0x04272F70, 0x80BB155C, 0x05282CE3,
            0x95C11548, 0xE4C66D22, 0x48C1133F, 0xC70F86DC,
            0x07F9C9EE, 0x41041F0F, 0x404779A4, 0x5D886E17,
            0x325F51EB, 0xD59BC0D1, 0xF2BCC18F, 0x41113564,
            0x257B7834, 0x602A9C60, 0xDFF8E8A3, 0x1F636C1B,
            0x0E12B4C2, 0x02E1329E, 0xAF664FD1, 0xCAD18115,
            0x6B2395E0, 0x333E92E1, 0x3B240B62, 0xEEBEB922,
            0x85B2A20E, 0xE6BA0D99, 0xDE720C8C, 0x2DA2F728,
            0xD0127845, 0x95B794FD, 0x647D0862, 0xE7CCF5F0,
            0x5449A36F, 0x877D48FA, 0xC39DFD27, 0xF33E8D1E,
            0x0A476341, 0x992EFF74, 0x3A6F6EAB, 0xF4F8FD37,
            0xA812DC60, 0xA1EBDDF8, 0x991BE14C, 0xDB6E6B0D,
            0xC67B5510, 0x6D672C37, 0x2765D43B, 0xDCD0E804,
            0xF1290DC7, 0xCC00FFA3, 0xB5390F92, 0x690FED0B,
            0x667B9FFB, 0xCEDB7D9C, 0xA091CF0B, 0xD9155EA3,
            0xBB132F88, 0x515BAD24, 0x7B9479BF, 0x763BD6EB,
            0x37392EB3, 0xCC115979, 0x8026E297, 0xF42E312D,
            0x6842ADA7, 0xC66A2B3B, 0x12754CCC, 0x782EF11C,
            0x6A124237, 0xB79251E7, 0x06A1BBE6, 0x4BFB6350,
            0x1A6B1018, 0x11CAEDFA, 0x3D25BDD8, 0xE2E1C3C9,
            0x44421659, 0x0A121386, 0xD90CEC6E, 0xD5ABEA2A,
            0x64AF674E, 0xDA86A85F, 0xBEBFE988, 0x64E4C3FE,
            0x9DBC8057, 0xF0F7C086, 0x60787BF8, 0x6003604D,
            0xD1FD8346, 0xF6381FB0, 0x7745AE04, 0xD736FCCC,
            0x83426B33, 0xF01EAB71, 0xB0804187, 0x3C005E5F,
            0x77A057BE, 0xBDE8AE24, 0x55464299, 0xBF582E61,
            0x4E58F48F, 0xF2DDFDA2, 0xF474EF38, 0x8789BDC2,
            0x5366F9C3, 0xC8B38E74, 0xB475F255, 0x46FCD9B9,
            0x7AEB2661, 0x8B1DDF84, 0x846A0E79, 0x915F95E2,
            0x466E598E, 0x20B45770, 0x8CD55591, 0xC902DE4C,
            0xB90BACE1, 0xBB8205D0, 0x11A86248, 0x7574A99E,
            0xB77F19B6, 0xE0A9DC09, 0x662D09A1, 0xC4324633,
            0xE85A1F02, 0x09F0BE8C, 0x4A99A025, 0x1D6EFE10,
            0x1AB93D1D, 0x0BA5A4DF, 0xA186F20F, 0x2868F169,
            0xDCB7DA83, 0x573906FE, 0xA1E2CE9B, 0x4FCD7F52,
            0x50115E01, 0xA70683FA, 0xA002B5C4, 0x0DE6D027,
            0x9AF88C27, 0x773F8641, 0xC3604C06, 0x61A806B5,
            0xF0177A28, 0xC0F586E0, 0x006058AA, 0x30DC7D62,
            0x11E69ED7, 0x2338EA63, 0x53C2DD94, 0xC2C21634,
            0xBBCBEE56, 0x90BCB6DE, 0xEBFC7DA1, 0xCE591D76,
            0x6F05E409, 0x4B7C0188, 0x39720A3D, 0x7C927C24,
            0x86E3725F, 0x724D9DB9, 0x1AC15BB4, 0xD39EB8FC,
            0xED545578, 0x08FCA5B5, 0xD83D7CD3, 0x4DAD0FC4,
            0x1E50EF5E, 0xB161E6F8, 0xA28514D9, 0x6C51133C,
            0x6FD5C7E7, 0x56E14EC4, 0x362ABFCE, 0xDDC6C837,
            0xD79A3234, 0x92638212, 0x670EFA8E, 0x406000E0  ],
        [   0x3A39CE37, 0xD3FAF5CF, 0xABC27737, 0x5AC52D1B,
            0x5CB0679E, 0x4FA33742, 0xD3822740, 0x99BC9BBE,
            0xD5118E9D, 0xBF0F7315, 0xD62D1C7E, 0xC700C47B,
            0xB78C1B6B, 0x21A19045, 0xB26EB1BE, 0x6A366EB4,
            0x5748AB2F, 0xBC946E79, 0xC6A376D2, 0x6549C2C8,
            0x530FF8EE, 0x468DDE7D, 0xD5730A1D, 0x4CD04DC6,
            0x2939BBDB, 0xA9BA4650, 0xAC9526E8, 0xBE5EE304,
            0xA1FAD5F0, 0x6A2D519A, 0x63EF8CE2, 0x9A86EE22,
            0xC089C2B8, 0x43242EF6, 0xA51E03AA, 0x9CF2D0A4,
            0x83C061BA, 0x9BE96A4D, 0x8FE51550, 0xBA645BD6,
            0x2826A2F9, 0xA73A3AE1, 0x4BA99586, 0xEF5562E9,
            0xC72FEFD3, 0xF752F7DA, 0x3F046F69, 0x77FA0A59,
            0x80E4A915, 0x87B08601, 0x9B09E6AD, 0x3B3EE593,
            0xE990FD5A, 0x9E34D797, 0x2CF0B7D9, 0x022B8B51,
            0x96D5AC3A, 0x017DA67D, 0xD1CF3ED6, 0x7C7D2D28,
            0x1F9F25CF, 0xADF2B89B, 0x5AD6B472, 0x5A88F54C,
            0xE029AC71, 0xE019A5E6, 0x47B0ACFD, 0xED93FA9B,
            0xE8D3C48D, 0x283B57CC, 0xF8D56629, 0x79132E28,
            0x785F0191, 0xED756055, 0xF7960E44, 0xE3D35E8C,
            0x15056DD4, 0x88F46DBA, 0x03A16125, 0x0564F0BD,
            0xC3EB9E15, 0x3C9057A2, 0x97271AEC, 0xA93A072A,
            0x1B3F6D9B, 0x1E6321F5, 0xF59C66FB, 0x26DCF319,
            0x7533D928, 0xB155FDF5, 0x03563482, 0x8ABA3CBB,
            0x28517711, 0xC20AD9F8, 0xABCC5167, 0xCCAD925F,
            0x4DE81751, 0x3830DC8E, 0x379D5862, 0x9320F991,
            0xEA7A90C2, 0xFB3E7BCE, 0x5121CE64, 0x774FBE32,
            0xA8B6E37E, 0xC3293D46, 0x48DE5369, 0x6413E680,
            0xA2AE0810, 0xDD6DB224, 0x69852DFD, 0x09072166,
            0xB39A460A, 0x6445C0DD, 0x586CDECF, 0x1C20C8AE,
            0x5BBEF7DD, 0x1B588D40, 0xCCD2017F, 0x6BB4E3BB,
            0xDDA26A7E, 0x3A59FF45, 0x3E350A44, 0xBCB4CDD5,
            0x72EACEA8, 0xFA6484BB, 0x8D6612AE, 0xBF3C6F47,
            0xD29BE463, 0x542F5D9E, 0xAEC2771B, 0xF64E6370,
            0x740E0D8D, 0xE75B1357, 0xF8721671, 0xAF537D5D,
            0x4040CB08, 0x4EB4E2CC, 0x34D2466A, 0x0115AF84,
            0xE1B00428, 0x95983A1D, 0x06B89FB4, 0xCE6EA048,
            0x6F3F3B82, 0x3520AB82, 0x011A1D4B, 0x277227F8,
            0x611560B1, 0xE7933FDC, 0xBB3A792B, 0x344525BD,
            0xA08839E1, 0x51CE794B, 0x2F32C9B7, 0xA01FBAC9,
            0xE01CC87E, 0xBCC7D1F6, 0xCF0111C3, 0xA1E8AAC7,
            0x1A908749, 0xD44FBD9A, 0xD0DADECB, 0xD50ADA38,
            0x0339C32A, 0xC6913667, 0x8DF9317C, 0xE0B12B4F,
            0xF79E59B7, 0x43F5BB3A, 0xF2D519FF, 0x27D9459C,
            0xBF97222C, 0x15E6FC2A, 0x0F91FC71, 0x9B941525,
            0xFAE59361, 0xCEB69CEB, 0xC2A86459, 0x12BAA8D1,
            0xB6C1075E, 0xE3056A0C, 0x10D25065, 0xCB03A442,
            0xE0EC6E0E, 0x1698DB3B, 0x4C98A0BE, 0x3278E964,
            0x9F1F9532, 0xE0D392DF, 0xD3A0342B, 0x8971F21E,
            0x1B0A7441, 0x4BA3348C, 0xC5BE7120, 0xC37632D8,
            0xDF359F8D, 0x9B992F2E, 0xE60B6F47, 0x0FE3F11D,
            0xE54CDA54, 0x1EDAD891, 0xCE6279CF, 0xCD3E7E6F,
            0x1618B166, 0xFD2C1D05, 0x848FD2C5, 0xF6FB2299,
            0xF523F357, 0xA6327623, 0x93A83531, 0x56CCCD02,
            0xACF08162, 0x5A75EBB5, 0x6E163697, 0x88D273CC,
            0xDE966292, 0x81B949D0, 0x4C50901B, 0x71C65614,
            0xE6C6C7BD, 0x327A140A, 0x45E1D006, 0xC3F27B9A,
            0xC9AA53FD, 0x62A80F00, 0xBB25BFE2, 0x35BDD2F6,
            0x71126905, 0xB2040222, 0xB6CBCF7C, 0xCD769C2B,
            0x53113EC0, 0x1640E3D3, 0x38ABBD60, 0x2547ADF0,
            0xBA38209C, 0xF746CE76, 0x77AFA1C5, 0x20756060,
            0x85CBFE4E, 0x8AE88DD8, 0x7AAAF9B0, 0x4CF9AA7E,
            0x1948C25C, 0x02FB8A8C, 0x01C36AE4, 0xD6EBE1F9,
            0x90D4F869, 0xA65CDEA0, 0x3F09252D, 0xC208E69F,
            0xB74E6132, 0xCE77E25B, 0x578FDFE3, 0x3AC372E6  ]
    ];

    var BLOWFISH_CTX = {
        pbox: [],
        sbox: []
    }

    function F(ctx, x){
        let a = (x >> 24) & 0xFF;
        let b = (x >> 16) & 0xFF;
        let c = (x >> 8) & 0xFF;
        let d = x & 0xFF;

        let y = ctx.sbox[0][a] + ctx.sbox[1][b];
        y = y ^ ctx.sbox[2][c];
        y = y + ctx.sbox[3][d];

        return y;
    }

    function BlowFish_Encrypt(ctx, left, right){
        let Xl = left;
        let Xr = right;
        let temp;

        for(let i = 0; i < N; ++i){
            Xl = Xl ^ ctx.pbox[i];
            Xr = F(ctx, Xl) ^ Xr;

            temp = Xl;
            Xl = Xr;
            Xr = temp;
        }

        temp = Xl;
        Xl = Xr;
        Xr = temp;

        Xr = Xr ^ ctx.pbox[N];
        Xl = Xl ^ ctx.pbox[N + 1];

        return {left: Xl, right: Xr};
    }

    function BlowFish_Decrypt(ctx, left, right){
        let Xl = left;
        let Xr = right;
        let temp;

        for(let i = N + 1; i > 1; --i){
            Xl = Xl ^ ctx.pbox[i];
            Xr = F(ctx, Xl) ^ Xr;

            temp = Xl;
            Xl = Xr;
            Xr = temp;
        }

        temp = Xl;
        Xl = Xr;
        Xr = temp;

        Xr = Xr ^ ctx.pbox[1];
        Xl = Xl ^ ctx.pbox[0];

        return {left: Xl, right: Xr};
    }

    /**
     * Initialization ctx's pbox and sbox.
     *
     * @param {Object} ctx The object has pbox and sbox.
     * @param {Array} key An array of 32-bit words.
     * @param {int} keysize The length of the key.
     *
     * @example
     *
     *     BlowFishInit(BLOWFISH_CTX, key, 128/32);
     */
    function BlowFishInit(ctx, key, keysize)
    {
        for(let Row = 0; Row < 4; Row++)
        {
            ctx.sbox[Row] = [];
            for(let Col = 0; Col < 256; Col++)
            {
                ctx.sbox[Row][Col] = ORIG_S[Row][Col];
            }
        }

        let keyIndex = 0;
        for(let index = 0; index < N + 2; index++)
        {
            ctx.pbox[index] = ORIG_P[index] ^ key[keyIndex];
            keyIndex++;
            if(keyIndex >= keysize)
            {
                keyIndex = 0;
            }
        }

        let Data1 = 0;
        let Data2 = 0;
        let res = 0;
        for(let i = 0; i < N + 2; i += 2)
        {
            res = BlowFish_Encrypt(ctx, Data1, Data2);
            Data1 = res.left;
            Data2 = res.right;
            ctx.pbox[i] = Data1;
            ctx.pbox[i + 1] = Data2;
        }
        
        for(let i = 0; i < 4; i++)
        {
            for(let j = 0; j < 256; j += 2)
            {
                res = BlowFish_Encrypt(ctx, Data1, Data2);
                Data1 = res.left;
                Data2 = res.right;
                ctx.sbox[i][j] = Data1;
                ctx.sbox[i][j + 1] = Data2;
            }
        }

        return true;
    }

    /**
     * Blowfish block cipher algorithm.
     */
    var Blowfish = C_algo.Blowfish = BlockCipher.extend({
        _doReset: function () {
            // Skip reset of nRounds has been set before and key did not change
            if (this._keyPriorReset === this._key) {
                return;
            }

            // Shortcuts
            var key = this._keyPriorReset = this._key;
            var keyWords = key.words;
            var keySize = key.sigBytes / 4;

            //Initialization pbox and sbox
            BlowFishInit(BLOWFISH_CTX, keyWords, keySize);
        },

        encryptBlock: function (M, offset) {
            var res = BlowFish_Encrypt(BLOWFISH_CTX, M[offset], M[offset + 1]);
            M[offset] = res.left;
            M[offset + 1] = res.right;
        },

        decryptBlock: function (M, offset) {
            var res = BlowFish_Decrypt(BLOWFISH_CTX, M[offset], M[offset + 1]);
            M[offset] = res.left;
            M[offset + 1] = res.right;
        },

        blockSize: 64/32,

        keySize: 128/32,

        ivSize: 64/32
    });

    /**
     * Shortcut functions to the cipher's object interface.
     *
     * @example
     *
     *     var ciphertext = CryptoJS.Blowfish.encrypt(message, key, cfg);
     *     var plaintext  = CryptoJS.Blowfish.decrypt(ciphertext, key, cfg);
     */
    C.Blowfish = BlockCipher._createHelper(Blowfish);
}());