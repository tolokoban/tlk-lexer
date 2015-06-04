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
  this._hooks = args.hooks;
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
    f = functionalize.call(this, val);
    f.id = "Rule_" + key;
    this._rules[key] = f;
  }
  this._args = args;
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
  this._tree = {};
  return rule.call(this);
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
 * Transform a tree into a matching function.
 */
function functionalize(root) {
  var that = this;
  var f, child, backup, i, rule, token, occurs, children;
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
        f = function() {
          if (this.eof()) return false;
          var tkn = this.next();
          if (tkn.id == root.name) return true;
          this._cursor--;
          return false;
        };
        f.id = "Token_" + root.name;
        return f;
      }
      f = function() {
        return this._rules[root.name].call(this);
      };
      f.id = "Rule_" + root.name;
      return f;
      //------------------
    case "OCCUR":
      child = functionalize.call(that, root.children[0]);
      if (root.min == 0 && root.max == 1) {
        // Occur "?" = 0..1
        f = function() {
          child.call(that);
          return true;
        };
        f.id = "Occur_zero_one";
        return f;
      }
      f = function() {
        backup = this._cursor;
        occurs = 0;
        while (occurs < root.max) {
          if (!child.call(that)) break;
        }
        if (occurs >= root.min && occurs <= root.max) return true;
        this._cursor = backup;
        return false;
      };
      f.id = "Occur_" + root.min + "_" + root.max;
      return f;
      //------------------
    case "SEQ":
      children = [];
      for (i = 0 ; i < root.children.length ; i++) {
        children.push(functionalize.call(that, root.children[i]));
      }
      f = function() {
        backup = this._cursor;
        for (i = 0 ; i < children.length ; i++) {
          child = children[i];
          if (!child.call(that)) {
            this._cursor = backup;
            return false;
          }
        }
        return true;
      };
      f.id = "SEQ";
      return f;
      //------------------
    case "ALT":
      children = [];
      for (i = 0 ; i < root.children.length ; i++) {
        children.push(functionalize.call(that, root.children[i]));
      }
      f = function() {
        backup = this._cursor;
        for (i = 0 ; i < children.length ; i++) {
          child = children[i];
          this._cursor = backup;
          if (child.call(that)) return true;
        }
        this._cursor = backup;
        return false;
      };
      f.id = "ALT";
      return f;
      //------------------
      case "OPEN":
      return functionalize.call(that, root.children[0]);
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
  if (root.id == 'ALT' && root.children.length < 2) {
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
