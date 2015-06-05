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
            expression: "add | mul | atom",
            add: "atom ADD expression",
            mul: "atom (MUL atom)+",
            atom: "NUM | bloc",
            bloc: "OPEN expression CLOSE"
          },
          ignore: "SPC",
          hooks: {
            expression: function(topDown) {
              if (topDown) {
                this.push();
              } else {
                this.popAdd();
              }
            },
            factor: function(topDown) {
              if (topDown) {
                this.push();
              } else {
                this.popMul();
              }
            },
            NUM: function(value) {
              this.append(parseInt(value));
            }
          }
        }
      );
      this.match = function(expression, value) {
        var Context = function() {
          this.stack = [[]];
        };
        Context.prototype.push = function() {
          this.stack.push([]);
        };
        Context.prototype.append = function(v) {
          this.stack[this.stack.length - 1].push(v);
        };
        Context.prototype.popAdd = function() {
          var result = 0;
          var arr = this.stack.pop();
          arr.forEach(
            function(v) {
              result += v;
            }
          );
          this.append(result);
        };
        Context.prototype.popMul = function() {
          var result = 1;
          var arr = this.stack.pop();
          arr.forEach(
            function(v) {
              result *= v;
            }
          );
          this.append(result);
        };        
        var context = new Context();
        var result = scanner.parseText(expression, context);
        //console.log(expression + " = " + JSON.stringify(context.stack));
        expect(result).toBe(true);
        if (typeof value === 'undefined') return;
        //console.log("----------------------------------------");
        //console.log(scanner.debugText(expression));
        expect(context.stack[0][0]).toBe(value);
      };
    });
/*
    it("TEST", function() {
      this.match("3+5", 8);
    });
*/
    it("should match single numbers", function() {
      this.match("256");
      this.match("6");
    });
    it("should match single numbers surrounded by spaces", function() {
      this.match("   654");
      this.match("654   ");
      this.match("  654  ");
    });
    it("should match single addition", function() {
      this.match("8+9");
      this.match("91 + 54 + 11");
    });
    it("should match single multiplication", function() {
      this.match("8*9");
      this.match("91 * 54 * 11");
    });
    it("should match mix of addition and multiplication", function() {
      this.match("8+9 * 3");
      this.match("91 * 54 + 11");
    });
    it("should compute additions", function() {
      this.match("8+9", 8 + 9);
      this.match("91 + 54 + 11", 91 + 54 + 11);
    });
    ["1+2", "1+2+3", "8+9*3", "3*9+8"].forEach(
      function(item) {
        var result = eval(item);
        it("should compute " + item + " = " + result, function() {
          this.match(item, result);
        });
      }
    );
  });
});
