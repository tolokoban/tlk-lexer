module.exports = {
    Lexer: require('./src/tlk-lexer')
};


/* Tests... */


var Lexer = module.exports.Lexer;

var lexer = new Lexer({
    value: "(-?(\.[0-9]+|[0-9]+(\.[0-9]+)?))|true|false|null|('(\\.|[^\\']+)*')",
    comma: "[ \t\n\r]*,[ \t\n\r]*",
    colon: "[ \t\n\r]*:[ \t\n\r]*",
    equal: "[ \t\n\r]*=[ \t\n\r]*",
    name: "[$a-zA-Z_-][$a-zA-Z_0-9-]+"
});



var code = "view-task-close:text, btnCancelTaskClose:value=false, btnConfirmTaskClose:action=false";

code = code.trim();
lexer.loadText( code );
try {
    var tkn, widget, attribute = 'action', value, bindings = [];

    function addBinding() {
        if (typeof widget === 'string') {
            var binding = [widget, attribute];
            if (typeof value !== 'undefined') {
                binding.push( value );
            }
            bindings.push( binding );
            widget = undefined;
            attribute = 'action';
            value = undefined;
        }
    }
    
    while (true) {
        tkn = lexer.next();
        if (null === tkn) break;
        if (tkn.id != 'name') throw Error("Expected `name`, but found `" + tkn.id + "`!`");
        widget = lexer.text( tkn );
        
        tkn = lexer.next();
        if (null === tkn) break;
        if (tkn.id == 'colon') {
            tkn = lexer.next();
            if (null === tkn) throw Error("Missing `name` after `:`!`");
            if (tkn.id != 'name') throw Error("Expected `name` after `:`, but found `" + tkn.id + "`!`");
            attribute = lexer.text( tkn );
            tkn = lexer.next();
            if (null === tkn) break;
        }
        if (tkn.id == 'equal') {
            tkn = lexer.next();
            if (null === tkn) throw Error("Missing `value` after `=`!`");
            if (tkn.id != 'value') throw Error("Expected `value` after `=`, but found `" + tkn.id + "`!`");
            value = lexer.text( tkn );
            tkn = lexer.next();
            if (null === tkn) break;
        }
        if (tkn.id != 'comma')throw Error("Expected `comma`, but found `" + tkn.id + "`!`");
        addBinding();
    }
    addBinding();

    console.log(JSON.stringify( bindings ));
}
catch (err) {
    console.error(err);
}
