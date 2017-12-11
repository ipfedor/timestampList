"use strict";

var _MAX_LEVEL = 7; // 2^53 = (2^8)^7

function decomposer(id)
{
    var ids = new Array(_MAX_LEVEL);
    for (var level = 0; level < _MAX_LEVEL; level++) {
        ids[level] = (id > 0 && isFinite(id)) ? Math.floor(id / (256 ** level)) * (256 ** level) : id;
    }
    return ids;
}

class idItem
{
    constructor(id, item, plainNext, plainPrev)
    {
        this.ids = decomposer(id);
        this.item = item;
        this.next = new Array(_MAX_LEVEL);
        this.plainNext = plainNext ? plainNext : false;
        this.plainPrev = plainPrev ? plainPrev : false;
    }

    createSublist()
    {
        this.sublist = new idList(this.plainlist, this);
    }
}

class idList
{
    constructor(plainlist, parent)
    {
        if (parent) {
            this.parent = parent;
        }
        this.plainlist = plainlist;
        this.head = new idItem(-1, null, null, null);
        this.tail = new idItem(Number.POSITIVE_INFINITY, null, null, this.head);
        this.head.plainNext = this.tail;
        for (var level = _MAX_LEVEL - 1; level > -1 ; level--) {
            this.head.next[level] = this.tail;
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
        if (!isFinite(id) || id < 1) {
            throw new TypeError('Requires numeric id, but received: ' + String(id));
        }
        var ids = decomposer(id);
        var node = this.head;
        var update = new Array(_MAX_LEVEL);
        for (var level = _MAX_LEVEL - 1; level > -1; level--) {
            while (node.next[level].ids[level] < ids[level]) {
                node = node.next[level]; // node with maximum id, < new id
            }
            update[level] = node; // store nearest left node
        }
        // node with minimum id, > new id
        node = node.next[0];
        var entry;
        if (node.ids[0] === id) {
            // existed element, replace only
            node.item = item;
            entry = node;
        } else {
            entry = new idItem(id, item, update[0]);
            var left = update[0];
            var right = node;
            /*
            while (left.id < 0 && this.parent) {
                // recursive left find
                left = this.parent;
            }
            */
            left.plainNext = entry;
            entry.plainPrev = left;
            entry.plainNext = right;
            right.plainPrev = entry;
            for (var i = 0; i < _MAX_LEVEL; i++) {
                if (i == 0 || update[i].next[i].ids[i] != ids[i]) {
                    entry.next[i] = update[i].next[i];
                    update[i].next[i] = entry;
                }
            }
        }
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
        var update = new Array(_MAX_LEVEL);
        for (var level = _MAX_LEVEL - 1; level > -1; level--) {
            while (node.next[level].ids[level] < ids[level]) {
                node = node.next[level];
            }
            update[level] = node;
        }
        node = node.next[0]; // id node
        if (node === this.tail) {
            return;
        }
        var left = update[0];
        var right = node.plainNext;
        /*
        while (left.id < 0 && this.parent) {
            // recursive left find
            left = this.parent;
        }
        */
        left.plainNext = right;
        right.plainPrev = left;
        for (var level = 0; level < _MAX_LEVEL; level++) {
            if (update[level].next[level] !== node) {
                break;
            } else {
                update[level].next[level] = node.next[level];
            }
        }
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

/*
    id          thread_id   to_id
    1           0           0
        2       1           1
            3   1           2
            4   1           2
    5           0           0
        6       5           5
        7       5           5
            8   5           7
*/
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

    set(row)
    {
        this.valid(row);
        var hypothesis, argument, comment;
        if (row.to_id == 0) {
            // work with hypothesis
            hypothesis = this.hypothesis.set(row.id, row);
            if (this.plainlist[row.id] === undefined) {
                // create new hypothesis
                hypothesis.createSublist();
            }
            this.plainlist[row.id] = hypothesis;
            return hypothesis;
        } else {
            hypothesis = this.hypothesis.get(row.thread_id);
            if (hypothesis === false) {
                // need create fake hypothesis
                var rowHypothesis = {id: row.thread_id, thread_id: 0, to_id: 0, empty: true};
                hypothesis = this.hypothesis.set(row.thread_id, rowHypothesis);
                hypothesis.createSublist();
                this.plainlist[row.thread_id] = hypothesis;
            }
            if (row.to_id == row.thread_id) {
                // work with arguments
                argument = hypothesis.sublist.set(row.id, row);
                if (this.plainlist[row.id] === undefined) {
                    argument.createSublist();
                }
                this.plainlist[row.id] = argument;
                return argument;
            } else {
                // work with comments
                argument = hypothesis.sublist.get(row.to_id);
                if (argument === false) {
                    var rowArgument = {id: row.to_id, thread_id: row.thread_id, to_id: row.thread_id, empty: true};
                    argument = hypothesis.sublist.set(row.to_id, rowArgument);
                    argument.createSublist();
                    this.plainlist[row.to_id] = argument;
                }
                comment = argument.sublist.set(row.id, row);
                this.plainlist[row.id] = comment;
                return comment;
            }
        }
    }
}