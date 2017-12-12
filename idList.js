"use strict";

var _MAX_LEVEL = 7; // 2^53 = (2^8)^7

function decomposer(id)
{
    var ids = new Array(_MAX_LEVEL);
    for (var level = 0; level < _MAX_LEVEL; level++) {
        ids[level] = isFinite(id) ? Math.floor(id / (256 ** level)) * (256 ** level) : id;
    }
    return ids;
}

class idItem
{
    constructor(id, item, parent)
    {
        this.ids = decomposer(id);
        this.item = item;
        this.next = new Array(_MAX_LEVEL);
        this.plainNext = null;
        this.plainPrev = null;
        this.parent = parent ? parent : null;
    }

    createSublist()
    {
        if (this.sublist === undefined) {
            this.sublist = new idList(this.plainlist, this);
            this.sublist.head.plainPrev = this;
            this.sublist.tail.plainNext = this.plainNext;
            this.plainNext.plainPrev = this.sublist.tail;
            this.plainNext = this.sublist.head;
        }
    }
}

class idList
{
    constructor(plainlist, parent)
    {
        this.parent = parent ? parent : null;
        this.plainlist = plainlist ? plainlist : {};
        this.head = new idItem(Number.NEGATIVE_INFINITY, null, this);
        this.tail = new idItem(Number.POSITIVE_INFINITY, null, this);
        this.head.plainNext = this.tail;
        this.tail.plainPrev = this.head;
        for (var level = _MAX_LEVEL - 1; level > -1 ; level--) {
            this.head.next[level] = this.tail;
        }
        if (!parent) {
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
            entry = new idItem(id, item, node.parent);
            line[0].plainNext = entry;
            entry.plainPrev = line[0];
            entry.plainNext = node;
            node.plainPrev = entry;
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
        var left = line[0];
        var right = node.next[0];
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
    constructor()
    {
        this.plainlist = {};
        this.hypothesis = new idList(this.plainlist);     // hypothesis list
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
            } while (item.ids[0] === Number.NEGATIVE_INFINITY || item.ids[0] === Number.POSITIVE_INFINITY && item.parent.parent);
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
            } while (item.ids[0] === Number.POSITIVE_INFINITY || item.ids[0] === Number.NEGATIVE_INFINITY && item.parent.parent);
            return item;
        } else {
            return item.plainPrev;
        }
    }
    
    isTopHead(item)
    {
        return !item.parent.parent && item.ids[0] === Number.NEGATIVE_INFINITY;
    }

    isTopTail(item)
    {
        return !item.parent.parent && item.ids[0] === Number.POSITIVE_INFINITY;
    }

    unset(id)
    {
        var item = this.plainlist[id];
        if (item) {
            if (item.sublist && item.sublist.head.plainNext != item.sublist.tail) {
                throw new TypeError('Can not delete an item with children: ' + String(id));
            }
            item.parent.unset(id);
        }
    }
    
    set(row)
    {
        this.valid(row);
        var hypothesis, argument, comment;
        if (row.to_id == 0) {
            // work with hypothesis
            hypothesis = this.hypothesis.set(row.id, row);
            this.plainlist[row.id] = hypothesis;
            return hypothesis;
        } else {
            hypothesis = this.hypothesis.get(row.thread_id);
            if (hypothesis === false) {
                // need create fake hypothesis
                var rowHypothesis = {id: row.thread_id, thread_id: 0, to_id: 0, empty: true};
                hypothesis = this.hypothesis.set(row.thread_id, rowHypothesis);
                this.plainlist[row.thread_id] = hypothesis;
            }
            hypothesis.createSublist();
            if (row.to_id == row.thread_id) {
                // work with arguments
                argument = hypothesis.sublist.set(row.id, row);
                this.plainlist[row.id] = argument;
                return argument;
            } else {
                // work with comments
                argument = hypothesis.sublist.get(row.to_id);
                if (argument === false) {
                    var rowArgument = {id: row.to_id, thread_id: row.thread_id, to_id: row.thread_id, empty: true};
                    argument = hypothesis.sublist.set(row.to_id, rowArgument);
                    this.plainlist[row.to_id] = argument;
                }
                argument.createSublist();
                comment = argument.sublist.set(row.id, row);
                this.plainlist[row.id] = comment;
                return comment;
            }
        }
    }
}