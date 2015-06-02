"use strict";

var grammar = {
  expression: "NUM operation*",
  operation: "add | mul",
  add: "ADD NUM",
  mul: "MUL NUM"
};

var hooks = {
  NUM: function(token) {
    var num = token.text();

  }
};


var Lexer = require("tlk-lexer");
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
 * var TlkLexer = require("tlk-lexer");
 * var lex = new TlkLexer({SPC: "[ \n\t\r]+", NUM: "[0-9]+", ADD: "\\+"});
 * var instance = new TlkScanner(lex);
 * @class TlkScanner
 */
var TlkScanner = function(grammar, lex) {
  this._grammar = {};
  var key, val;
  for (key in grammar) {
    val = grammar[key];
    this._grammar[key] = build(val, lex);
  }

};

/**
 * @return void
 */
TlkScanner.prototype.parse = function(lex, context) {
  if (typeof context === 'undefined') context = {};
  this._ctx = context;
  
};


TlkScanner.create = function(grammar, lexer) {
  return new TlkScanner(grammar, lexer);
};
module.exports = TlkScanner;


function build(rule, lex) {
  ruleLexer.loadText(rule);
  var tokens = ruleLexer.all("SPC");
  if (tokens.length < 1) throw Error("Empty rule!");
  var root = buildTree(tokens, 0);  

}


/**
 * @return New position of `index`.
 */
function buildTree(tokens, index) {
  var root = null;
  var tkn;
  while (index < tokens.length) {
    tkn = tokens[index];
    index++;
    tkn = convertToken(tkn);
  }


  return ["()", root];
}


/**
 * Each token will  be converted into a string.   Occurences will become
 * `{0-1}`, `{0-*}`,  `{1-*}`, `{3-3}`,  `{2-4}`, ...  Tokens  and rules
 * will become their names.
 */
function convertToken(tkn) {
  switch(tkn.id) {

  }
  return null;
}
