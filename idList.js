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
    constructor(id, item)
    {
        this.ids = decomposer(id);
        this.item = item;
        this.next = new Array(_MAX_LEVEL);
    }
}

class idList
{
    constructor()
    {
        this.head = new idItem(-1, null);
        this.tail = new idItem(Number.POSITIVE_INFINITY, null);
        for (var level = _MAX_LEVEL - 1; level > -1 ; level--) {
            this.head.next[level] = this.tail;
        }
    }

    getHead(id)
    {
        return this.head;
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
                node = node.next[level];
            }
            update[level] = node;
        }
        node = node.next[0];
        var entry;
        if (node.ids[0] === id) {
            node.item = item;
            entry = node;
        } else {
            entry = new idItem(id, item);
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
        node = node.next[0];
        if (node === this.tail) {
            return;
        }
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
        this.hypothesis = new idList();     // hypothesis list
    }

    valid(row)
    {
        if (row === undefined || row.id === undefined || typeof row.id !== 'number') {
            throw new TypeError('Requires numeric id, but received: ' + String(row.id));
        }
    }

    set(row)
    {
        this.valid(row);
        var hypothesis, argument, comment;
        if (row.to_id == 0) {
            // work with hypothesis
            hypothesis = this.hypothesis.get(row.id);
            if (hypothesis === false) {
                // create new hypothesis
                row.arguments = new idList();
                hypothesis = this.hypothesis.set(row.id, row);
            }
            return hypothesis;
        } else {
            hypothesis = this.hypothesis.get(row.thread_id);
            if (hypothesis === false) {
                // need create fake hypothesis
                var rowHypothesis = {id: row.thread_id, thread_id: 0, to_id: 0, arguments: new idList(), empty: true};
                hypothesis = this.hypothesis.set(row.thread_id, rowHypothesis);
            }
            if (row.to_id == row.thread_id) {
                // work with arguments
                argument = hypothesis.arguments.get(row.id);
                if (argument === false) {
                    row.comments = new idList();
                    argument = hypothesis.arguments.set(row.id, row);
                }
                return argument;
            } else {
                // work with comments
                argument = hypothesis.arguments.get(row.to_id);
                if (argument === false) {
                    var rowArgument = {id: row.to_id, thread_id: row.thread_id, to_id: row.thread_id, comments: new idList(), empty: true};
                    argument = hypothesis.arguments.set(row.to_id, row);
                }
                comment = argument.set(row.id, row);
                return comment;
            }
        }
    }
}