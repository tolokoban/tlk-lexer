'use strict';
var Scanner = require("../src/tlk-scanner");

describe("Scanner", function() {
  describe("grammar for simple arithmetics", function() {
    beforeAll(function() {
      var scanner = new Scanner(
        {
          tokens: {
            SPC: "[ \t\n\r]+",
            NUM: "[0-9]+",
            MUL: "\\*",
            ADD: "\\+",
            OPEN: "\\(",
            CLOSE: "\\)"
          },
          rules: {
            expression: "factor (ADD factor)?",
            factor: "atom (MUL atom)?",
            atom: "NUM | bloc",
            bloc: "OPEN expression CLOSE"
          },
          ignore: "SPC",
          hooks: {
            expression: function() {},
            factor: function() {},
            NUM: function() {}
          }
        }
      );
      this.match = function(expression) {
        var result = scanner.parseText(expression);
        expect(result).toBe(true);
      };
    });
    it("should match single numbers", function() {
      this.match("256");
      this.match("6");
    });
    it("should match single numbers surrounded by spaces", function() {
      this.match("   654");
      this.match("654   ");
      this.match("  654  ");
    });
  });
});
