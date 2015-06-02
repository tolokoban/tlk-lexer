"use strict";

/**
 * @example
 * var TlkLexer = require("tlk-lexer");
 * var instance = new TlkLexer();
 * @class TlkLexer
 */
var TlkLexer = function(tokensDefinition) {
  this._definitions = {main: build(tokensDefinition)};
  this._currentDef = this._definitions.main;
  this._buffers = [];
};

TlkLexer.ERR_NO_MATCHING_TOKEN = 1;

/**
 * @return Next available token or `null` if end of buffers is reached.
 * This is an object with the following attributes:
 * * __id__ {string}: ID of the token.
 * * __buffer__ {object}: Source buffer.
 * * __begin__ {number}: Index of the first char of the matching token.
 * * __end__ {number}: Index of the first char after the last char of the matching token.
 */
TlkLexer.prototype.next = function() {
  var nbBuffers = this._buffers.length;
  if (nbBuffers == 0) return null;
  var buff = this._buffers[nbBuffers - 1];
  if (buff.cursor < buff.size) {
    var tknID, tknMatcher, token;
    for (tknID in this._currentDef) {
      tknMatcher = this._currentDef[tknID];
      token = tknMatcher(buff);
      if (token) {
        token.id = tknID;
        buff.cursor = token.end;
        return token;
      }
    }
    throw {err: TlkLexer.ERR_NO_MATCHING_TOKEN, buff: buff};
  }
  // Buffer is over.
  this._buffers.pop();
  return null;
};

/**
 * @param ignoreList {array|string}: items' ID to ignore for the resulting list.
 * @return Array of all remaining tokens. Except for those in the _ignoreList_.
 */
TlkLexer.prototype.all = function(ignoreList) {
  if (typeof ignoreList === 'undefined') ignoreList = [];
  if (!Array.isArray(ignoreList)) ignoreList = [ignoreList];
  var tokens = [];
  var tkn;
  while (null != (tkn = this.next())) {
    if (ignoreList.indexOf(tkn.id) > -1) continue;
    tokens.push(tkn);
  }
  return tokens;
};

/**
 * @return void
 */
TlkLexer.prototype.loadText = function(text) {
  this._buffers.push(
    {
      text: text,
      size: text.length,
      cursor: 0,
      name: "buff#" + this._buffers.length
    }
  );
};


TlkLexer.create = function(tokensDefinition) {
  return new TlkLexer(tokensDefinition);
};
module.exports = TlkLexer;


function newMatcherRX(pattern) {
  var rx = new RegExp("^(" + pattern + ")");
  return function(buffer) {
    var match = rx.exec(buffer.text.substr(buffer.cursor));
    if (!match) return null;
    return {
      buffer: buffer,
      begin: buffer.cursor,
      end: buffer.cursor + match[0].length
    };
  };
}

function build(definitions) {
  var result = {};
  var key, val;
  for (key in definitions) {
    val = definitions[key];
    if (typeof val === 'string') {
      // This will be converted into a regexp.
      result[key] = newMatcherRX(val);
    }
  }
  return result;
}
