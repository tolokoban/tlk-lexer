'use strict';
var Lexer = require("../src/tlk-lexer");

describe("Lexer", function() {
  describe("simple arithmetic", function() {
    beforeAll(function() {
      this.check = function(text, expected) {
        var lex = new Lexer(
          {
            SPC: "[ \t\n\r]+",
            NUM: "[0-9]+",
            MUL: "\\*",
            ADD: "\\+"
          }
        );
        lex.loadText(text);
        var token, result = [], id;
        while (null != (token = lex.next())) {
          id = token.id;
          if (id == 'SPC') continue;
          result.push(id);
        }
        var tokens = [];
        expected = expected.split(",");
        expected.forEach(
          function(item) {
            tokens.push(item.trim());
          }
        );
        expect(result).toEqual(tokens);
      };
    });
    it("should handle simple arithmetic", function() {
      this.check("  57 + 3 * 21", "NUM, ADD, NUM, MUL, NUM");
    });
  });
});
