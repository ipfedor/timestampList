"use strict";
var _MAX_LEVEL = 7; // 2^53 = (2^8)^7

function decomposer(id)
{
    var ids = new Array(_MAX_LEVEL);
    for (var level = 0; level < _MAX_LEVEL; level++) {
        ids[level] = isFinite(id) ? Math.floor(id / (Math.pow(256, level))) * (Math.pow(256, level)) : id;
    }
    return ids;
}

class idItem
{
    constructor(id, item, parentlist)
    {
        this.ids = decomposer(id);
        this.item = item;
        this.next = new Array(_MAX_LEVEL);
        this.plainNext = null;
        this.plainPrev = null;
        this.parentlist = parentlist ? parentlist : null;
    }

    createSublist()
    {
        if (this.sublist === undefined) {
            this.sublist = new idList(this.parentlist.plainlist, this);
            this.sublist.head.plainPrev = this;
            this.sublist.tail.plainNext = this.plainNext;
            this.plainNext.plainPrev = this.sublist.tail;
            this.plainNext = this.sublist.head;
        }
    }
}

class idList
{
    constructor(plainlist, parentitem)
    {
        this.parentitem = parentitem ? parentitem : null;
        this.plainlist = plainlist ? plainlist : {};
        this.head = new idItem(Number.NEGATIVE_INFINITY, null, this);
        this.tail = new idItem(Number.POSITIVE_INFINITY, null, this);
        this.head.plainNext = this.tail;
        this.tail.plainPrev = this.head;
        for (var level = _MAX_LEVEL - 1; level > -1 ; level--) {
            this.head.next[level] = this.tail;
        }
        if (!parentitem) {
            this.plainlist[Number.NEGATIVE_INFINITY] = this.head;
            this.plainlist[Number.POSITIVE_INFINITY] = this.tail;
        }
    }

    getHead()
    {
        return this.head;
    }

    getTail()
    {
        return this.tail;
    }

    isHead(item)
    {
        return this.head === item;
    }

    isTail(item)
    {
        return this.tail === item;
    }

    set(id, item)
    {
        if (!isFinite(id)) {
            throw new TypeError('Requires numeric id, but received: ' + String(id));
        }
        var ids = decomposer(id);
        var node = this.head;
        var line = new Array(_MAX_LEVEL);
        for (var level = _MAX_LEVEL - 1; level > -1; level--) {
            while (node.next[level].ids[level] < ids[level]) {
                node = node.next[level]; // node with maximum id, < new id
            }
            line[level] = node; // store nearest left node
        }
        // node with minimum id, > new id
        node = node.next[0];
        var entry;
        if (node.ids[0] === id) {
            // existed element, replace only
            node.item = item;
            entry = node;
        } else {
            entry = new idItem(id, item, node.parentlist);
            line[0].next[0].plainPrev.plainNext = entry;
            entry.plainPrev = line[0].next[0].plainPrev;
            entry.plainNext = line[0].next[0];
            line[0].next[0].plainPrev = entry;
            for (var i = 0; i < _MAX_LEVEL; i++) {
                if (i == 0 || line[i].next[i].ids[i] != ids[i]) {
                    entry.next[i] = line[i].next[i];
                    line[i].next[i] = entry;
                }
            }
        }
        this.plainlist[id] = entry;
        return entry;
    }

    get(id)
    {
        var ids = decomposer(id);
        var node = this.head;
        for (var level = _MAX_LEVEL - 1; level > -1; level--) {
            while (node.next[level].ids[level] < ids[level]) {
                node = node.next[level];
            }
            if (node.next[level].ids[level] === id) {
                return node.next[level];
            }
        }
        return false;
    }

    has(id)
    {
        return this.get(id) !== false;
    }

    unset(id)
    {
        var ids = decomposer(id);
        var node = this.head;
        var line = new Array(_MAX_LEVEL);
        for (var level = _MAX_LEVEL - 1; level > -1; level--) {
            while (node.next[level].ids[level] < ids[level]) {
                node = node.next[level];
            }
            line[level] = node;
        }
        node = node.next[0]; // id node
        if (node === this.tail) {
            delete this.plainlist[id];
            return;
        }
        var left = node.plainPrev;
        var right = node.plainNext;
        left.plainNext = right;
        right.plainPrev = left;
        for (var level = 0; level < _MAX_LEVEL; level++) {
            if (line[level].next[level] !== node) {
                break;
            } else {
                line[level].next[level] = node.next[level];
            }
        }
        delete this.plainlist[id];
    }

    before(id)
    {
        var ids = decomposer(id);
        var node = this.head;
        for (var level = _MAX_LEVEL - 1; level > -1; level--) {
            while (node.next[level].ids[level] < ids[level]) {
                node = node.next[level];
            }
        }
        return node;
    }
}

class chatList
{
    constructor(options)
    {
        this.plainlist = {};
        this.hypothesis = new idList(this.plainlist);     // hypothesis list
    }

    empty()
    {
        var head = this.plainlist[Number.NEGATIVE_INFINITY]
        var tail = this.getPlainNext(head);
        return this.isTopTail(tail);
    }

    valid(row)
    {
        if (row === undefined || row.id === undefined || typeof row.id !== 'number') {
            throw new TypeError('Requires numeric id, but received: ' + String(row.id));
        }
    }

    get(id)
    {
        return (this.plainlist[id] === undefined) ? false : this.plainlist[id];
    }

    getParent(el)
    {
        return el.parentlist && el.parentlist.parentitem ? el.parentlist && el.parentlist.parentitem : false;
    }

    getHead()
    {
        return this.plainlist[Number.NEGATIVE_INFINITY];
    }

    getTail()
    {
        return this.plainlist[Number.POSITIVE_INFINITY];
    }

    // skip children head & tail
    getPlainNext(item, skip)
    {
        if (skip) {
            do {
                item = item.plainNext;
            } while (item.ids[0] === Number.NEGATIVE_INFINITY || item.ids[0] === Number.POSITIVE_INFINITY && item.parentlist.parentitem);
            return item;
        } else {
            return item.plainNext;
        }
    }

    getPlainPrev(item, skip)
    {
        if (skip) {
            do {
                item = item.plainPrev;
            } while (item.ids[0] === Number.POSITIVE_INFINITY || item.ids[0] === Number.NEGATIVE_INFINITY && item.parentlist.parentitem);
            return item;
        } else {
            return item.plainPrev;
        }
    }

    isTopHead(item)
    {
        return !item.parentlist.parentitem && item.ids[0] === Number.NEGATIVE_INFINITY;
    }

    isTopTail(item)
    {
        var check = item;
        while (check.ids[0] === Number.POSITIVE_INFINITY && check.plainNext && check.plainNext.item && item.parentlist.parentitem) {
            check = check.plainNext;
        }
        return check.ids[0] === Number.POSITIVE_INFINITY;
    }

    unset(id)
    {
        var item = this.plainlist[id];
        if (item) {
            if (item.sublist && item.sublist.head.plainNext != item.sublist.tail) {
                throw new TypeError('Can not delete an item with children: ' + String(id));
            }
            item.parentlist.unset(id);
        }
    }

    set(row)
    {
        this.valid(row);
        var hypothesis, argument, comment, exist = this.get[row.id];
        if (exist) {
            if (exist.item.thread_id == row.thread_id && exist.item.to_id == row.to_id) {
                exist.item = row;
                return exist;
            }
            // todo: need save ext attributes (template, etc)
            this.unset(row.id);
        }
        if (row.to_id == 0) {
            // work with hypothesis
            hypothesis = this.hypothesis.set(row.id, row);
            return hypothesis;
        } else {
            hypothesis = this.hypothesis.get(row.thread_id);
            if (hypothesis === false) {
                // need create fake hypothesis
                var rowHypothesis = {id: row.thread_id, thread_id: 0, to_id: 0, empty: true};
                hypothesis = this.hypothesis.set(row.thread_id, rowHypothesis);
            }
            hypothesis.createSublist();
            if (row.to_id == row.thread_id) {
                // work with arguments
                argument = hypothesis.sublist.set(row.id, row);
                return argument;
            } else {
                // work with comments
                argument = hypothesis.sublist.get(row.to_id);
                if (argument === false) {
                    var rowArgument = {id: row.to_id, thread_id: row.thread_id, to_id: row.thread_id, empty: true};
                    argument = hypothesis.sublist.set(row.to_id, rowArgument);
                }
                argument.createSublist();
                comment = argument.sublist.set(row.id, row);
                return comment;
            }
        }
    }
}