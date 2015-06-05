"use strict";
var Lexer = require("./tlk-lexer");

var ruleLexer = new Lexer(
  {
    SPC: "[ \t\n\r,;:-]+",
    ID: "[a-zA-Z][a-zA-Z_0-9]*",
    OPEN: "\\(",
    CLOSE: "\\)",
    OCCUR: "\\{[ \t]*[0-9]+([ \t:-]+[0-9]+)?[ \t]*\\}",
    ALT: "\\|",
    ZERO_ONE: "\\?",
    ZERO_MANY: "\\*",
    ONE_MANY: "\\+"
  }
);

/**
 * @example
 * var TlkScanner = require("tlk-scanner");
 * var lex = new TlkLexer({SPC: "[ \n\t\r]+", NUM: "[0-9]+", ADD: "\\+"});
 * var instance = new TlkScanner(
 *   {
 *     tokens: {SPC: "[ \n\t\r]+", NUM: "[0-9]+", ADD: "\\+"},
 *     rules: {
 *       expression: "bloc | NUM ope*",
 *       bloc: "OPEN expression CLOSE",
 *       ope: "(ADD | MUL) (bloc | NUM)"
 *     },
 *     ignore: "SPC"
 * );
 * @class TlkScanner
 */
var TlkScanner = function(args) {
  if (typeof args.ignore === 'undefined') args.ignore = [];
  if (typeof args.hooks === 'undefined') args.hooks = {};
  this.setHooks(args.hooks);
  this._rules = {};
  this._tokens = args.tokens;
  this._lexer = new Lexer(args.tokens);
  var key, val;
  for (key in args.rules) {
    val = args.rules[key];
    this._rules[key] = build.call(this, val);
  }
  // Convert each rule into a matching function.
  this._mainRule = null;
  var f;
  for (key in this._rules) {
    if (this._mainRule === null) {
      this._mainRule = key;
    }
    val = this._rules[key];
    f = functionalize.call(this, val, key);
    this._rules[key] = f;
  }
  this._args = args;
};

/**
 * @return void
 */
TlkScanner.prototype.setHooks = function(hooks) {
  this._hooks = hooks;
};

/**
 * @return void
 */
TlkScanner.prototype.debugText = function(source, ruleName) {
  this._lexer.loadText(source);
  var ctx = {level: 0, tokens: this._lexer.all(this._args.ignore), out: ''};
  var indent = function(v) {
    var out = '';
    while (v > 0) {
      out += "  ";
      v--;
    }
    return out;
  };
  var slotToken = function(text, hookItem) {
    this.out += indent(this.level) + hookItem.id + ': "' + text + '"\n';
  };
  var slotRule = function(topDown, hookItem) {
    if (topDown) {
      var tkn;
      var out = indent(this.level);
      out += hookItem.id + ': "';
      var complete = true;
      for (var i = Math.max(0, hookItem.begin) ; i < hookItem.end ; i++) {
        if (out.length > 70) {
          complete = false;
          break;
        }
        tkn = this.tokens[i];
        out += tkn.buffer.text.substr(tkn.begin, tkn.end - tkn.begin);
      }
      out += '"';
      if (!complete) out += '...';
      this.out += out + "\n";
      this.level++;
    } else {
      this.level--;
    }
  };
  var hooks = {}, key;
  for (key in this._rules) {
    hooks[key] = slotRule;
  }
  for (key in this._tokens) {
    hooks[key] = slotToken;
  }
  this.setHooks(hooks);
  if (this.parseText(source, ctx, ruleName)) {
    return ctx.out;
  }
  return null;
};

/**
 * @return void
 */
TlkScanner.prototype.parseText = function(source, context, ruleName) {
  if (typeof ruleName === 'undefined') ruleName = this._mainRule;
  if (typeof context === 'undefined') context = {};
  this._ctx = context;
  var rule = this._rules[ruleName];
  if (typeof rule === 'undefined') {
    throw Error("Unknown rule: \"" + ruleName + "\"!");
  }
  this._lexer.loadText(source);
  this._all = this._lexer.all(this._args.ignore);
  this._cursor = 0;
  // the  hooks chain  is  used  to deal  with  backtracking in  grammar
  // checking.  Hooks are added as soon as they match, but if the parent
  // rule fails, we have too rollback the child hooks.
  // A hook is an object:
  // {id: ..., begin: ..., end: ...} for rules
  // {id: ..., begin: ...} for tokens
  //
  this._hooksChain = [];
  if (this._hooks[ruleName]) {
    this._hooksChain.push({id: ruleName, begin: -1, end: this._all.length});
  }
  this._log = [];
  //var result = rule.call(this);
  var result = rule.exec();
  if (result && this._hooksChain.length > 0) {
    processHooks(this._hooksChain, this._hooks, context, this._all);
  }
  return result;
};

/**
 * @return _True_ if the end of file has been reached.
 */
TlkScanner.prototype.eof = function() {
  return this._cursor >= this._all.length;
};

/**
 * @return Next token.
 */
TlkScanner.prototype.next = function() {
  var tkn = this._all[this._cursor];
  this._cursor++;
  return tkn;
};


module.exports = TlkScanner;

///////////////////////
// PRIVATE FUNCTIONS //
///////////////////////


function build(rule, lex) {
  ruleLexer.loadText(rule);
  var tokens = ruleLexer.all("SPC");
  if (tokens.length < 1) throw Error("Empty rule!");
  var root = buildTree(tokens);
  return root;
}

/**
 * @param hooksChain {array} Array from the tail of which we want to remove all items with index > cursor.
 * @param cursor {number} Index of the last valid hooks' chain's item.
 */
function rollbackHooks(hooksChain, cursor) {
  var idx = hooksChain.length - 1;
  while (idx > -1 && hooksChain[idx].begin >= cursor) {
    hooksChain.pop();
    idx--;
  }
}

var MatcherToken = function(id, that, name) { this.id = id; this.that = that; this.name = name; };
MatcherToken.prototype.exec = function() {
  var that = this.that;
  if (that.eof()) return false;
  var tkn = that.next();
  if (tkn.id == this.name) {
    if (typeof that._hooks[tkn.id] !== 'undefined') {
      that._hooksChain.push({id: tkn.id, begin: that._cursor - 1});
    }
    return true;
  }
  that._cursor--;
  return false;
};

var MatcherRule = function(id, that, name) { this.id = id; this.that = that; this.name = name; };
MatcherRule.prototype.exec = function() {
  var that = this.that;
  var rule;
  if (typeof that._hooks[this.name] !== 'undefined') {
    var hookItem = {id: this.name, begin: that._cursor};
    that._hooksChain.push(hookItem);
    rule = that._rules[this.name];
    var result = rule.exec();
    if (!result) {
      rollbackHooks(that._hooksChain, hookItem.begin);
      return false;
    }
    hookItem.end = that._cursor;
    return true;
  }
  rule = that._rules[this.name];
  return rule.exec();
};

var MatcherOccur = function(id, that, matcher, min, max) {
  this.id = id;
  this.that = that;
  this.matcher = matcher;
  this.min = min;
  this.max = max;
};
MatcherOccur.prototype.exec = function() {
  var that = this.that;
  var backup = that._cursor;
  var occurs = 0;
  while (occurs < this.max) {
    if (!this.matcher.exec()) break;
    occurs++;
  }
  if (occurs >= this.min && occurs <= this.max) return true;
  that._cursor = backup;
  rollbackHooks(that._hooksChain, backup);
  return false;
};

var MatcherSeq = function(id, that, children) { this.id = id; this.that = that; this.children = children; };
MatcherSeq.prototype.exec = function() {
  var that = this.that;
  var backup = that._cursor;
  var child, children = this.children;
  for (var i = 0 ; i < children.length ; i++) {
    child = children[i];
    if (!child.exec()) {
      that._cursor = backup;
      rollbackHooks(that._hooksChain, backup);
      return false;
    }
  }
  return true;
};

var MatcherAlt = function(id, that, children) { this.id = id; this.that = that; this.children = children; };
MatcherAlt.prototype.exec = function() {
  var that = this.that;
  var backup = that._cursor;
  var child, children = this.children;
  for (var i = 0 ; i < children.length ; i++) {
    child = children[i];
    that._cursor = backup;
    if (child.exec()) return true;
  }
  that._cursor = backup;
  return false;
};


/**
 * Transform a tree into a matching function.
 */
function functionalize(root, prefix) {
  if (typeof prefix === 'undefined') prefix = "";
  var that = this;
  var f, a, b, child, backup, i, rule, token, occurs, children;
  switch(root.id) {
      //------------------
    case "ID":
      rule = this._rules[root.name];
      if (typeof rule === 'undefined') {
        token = this._tokens[root.name];
        if (typeof token === 'undefined') {
          throw Error("Unknown rule or token \"" + root.name + "\"!");
        }
        // Matching Token.
        return new MatcherToken( prefix + "/Token_" + root.name, that, root.name );
      }
      return new MatcherRule( prefix + "/Rule_" + root.name, that, root.name );
      //------------------
    case "OCCUR":
      child = functionalize.call(
        that,
        root.children[0],
        prefix + "/{" + root.min + "," + (root.max > 99999 ? "*" : root.max)  + "}"
      );
      return new MatcherOccur(
        prefix + "/Occur_" + root.min + "_" + (root.max > 99999 ? "*" : root.max),
        that, child, root.min, root.max
      );
      //------------------
    case "SEQ":
      children = [];
      for (i = 0 ; i < root.children.length ; i++) {
        children.push(functionalize.call(that, root.children[i], prefix + "/SEQ[" + i + "]"));
      }
      return new MatcherSeq( prefix + "/SEQ", that, children );
      //------------------
    case "ALT":
      children = [];
      for (i = 0 ; i < root.children.length ; i++) {
        children.push(functionalize.call(that, root.children[i], prefix + "/ALT[" + i + "]"));
      }
      return new MatcherAlt( prefix + "/ALT", that, children );
      //------------------
    case "OPEN":
      return functionalize.call(that, root.children[0], "/()");
  }
  throw Error("Can't functionalize this: " + JSON.stringify(root));
}

var priorities = {
  ID: 0,
  OPEN: 1,
  OCCUR: 2,
  SEQ: 3,
  ALT: 4
};

function insertIntoTree(root, node) {
  if (!root) return node;
  var priorRoot = priorities[root.id];
  var priorNode = priorities[node.id];
  var lastChild;
  if (priorRoot < 3 && priorNode < 2) {
    // Two successive IDs, OCCURs or groups must be stored in a SEQ.
    return {id: "SEQ", children: [root, node]};
  }
  if (priorNode > priorRoot) {
    node.children = [root];
    return node;
  }
  if (root.id == 'ALT' && (root.children.length < 2 || node.id == 'ALT')) {
    root.children.push(node);
    return root;
  }
  if (root.children.length > 0) {
    lastChild = root.children.pop();
    node = insertIntoTree(lastChild, node);
    if (root.id == node.id) {
      // This prevents neesting SEQ.
      node.children.forEach(
        function(child) {
          root.children.push(child);
        }
      );
    } else {
      root.children.push(node);
    }
  } else {
    root.children = [node];
  }
  return root;
}

/**
 * @return New position of `index`.
 */
function buildTree(tokens) {
  var root = null;
  var tkn, group;
  while (tokens.length > 0) {
    tkn = tokens.splice(0, 1)[0];
    tkn = convertToken(tkn);
    if (tkn.id == "CLOSE") break;
    if (tkn.id == "OPEN") {
      tkn.children = [buildTree(tokens)];
    }
    root = insertIntoTree(root, tkn);
  }

  return root;
}


var rxOccur = /\\{[ \t]*([0-9]+)[,: \t-]*([0-9]+)[ \t]*\\}/;

/**
 * Each token will  be converted into a string.   Occurences will become
 * `{0-1}`, `{0-*}`,  `{1-*}`, `{3-3}`,  `{2-4}`, ...  Tokens  and rules
 * will become their names.
 */
function convertToken(tkn) {
  var item = {id: tkn.id, children: []};
  switch(tkn.id) {
    case "ID":
      item.name = tkn.buffer.text.substr(tkn.begin, tkn.end - tkn.begin);
      break;
    case "OCCUR":
      var match = rxOccur.exec(tkn.buffer.substr(tkn.begin, tkn.end - tkn.begin));
      item.min = parseInt(match[1]);
      item.max = parseInt(match[2]);
      break;
    case "ZERO_ONE":
      item.id = "OCCUR";
      item.min = 0;
      item.max = 1;
      break;
    case "ZERO_MANY":
      item.id = "OCCUR";
      item.min = 0;
      item.max = 999999999;
      break;
    case "ONE_MANY":
      item.id = "OCCUR";
      item.min = 1;
      item.max = 999999999;
      break;
  }
  return item;
}


function processHooks(hooksChain, hooks, context, tokens) {
  var stack = [];
  hooksChain.forEach(
    function(hookItem, index) {
      var last = stack.length - 1;
      while (last > -1) {
        if (stack[last].end > hookItem.begin) break;
        f = hooks[stack.pop().id];
        f.call(context, false, hookItem);
        last--;
      }
      var f = hooks[hookItem.id];
      if (typeof hookItem.end === 'undefined') {
        // Token.
        var tkn = tokens[hookItem.begin];
        f.call(context, tkn.buffer.text.substr(tkn.begin, tkn.end - tkn.begin), hookItem);
      } else {
        // Rule.
        stack.push(hookItem);
        f.call(context, true, hookItem);
      }
    }
  );
  var slot, hookItem;
  while (stack.length > 0) {
    hookItem = stack.pop();
    slot = hooks[hookItem.id];
    slot.call(context, false, hookItem);
  }
}
