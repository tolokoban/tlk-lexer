module.exports = {
    Lexer: require('./src/tlk-lexer')
};


/* Tests... */


var Lexer = module.exports.Lexer;

var lexer = new Lexer({
    name: "[$a-zA-Z_-][$a-zA-Z_0-9-]+",
    number: "-?(\.[0-9]+|[0-9]+(\.[0-9]+)?)",
    keyword: "true|false|null",
    string: "'(\\.|[^\\']+)*'",
    comma: "[ \t\n\r]*,[ \t\n\r]*",
    colon: "[ \t\n\r]*:[ \t\n\r]*",
    equal: "[ \t\n\r]*=[ \t\n\r]*"
});



var code = "view-task-close:text, btnCancelTaskClose:value=false, btnConfirmTaskClose:action=false";

code = code.trim();
lexer.loadText( code );
try {
    var tokens = lexer.all();
    console.log(JSON.stringify( tokens.map(function(itm) {return itm.id;}), null, '  ' ));
}
catch (err) {
    console.error(err);
}
