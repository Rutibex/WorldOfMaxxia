using System.Text.RegularExpressions;
namespace MaxxiaMaker.ProjectModel;
/// <summary>MM11: C# authoring-side grammar/size validation for canonical TypeScript expressions.
/// Execution and seeded rolls always happen in TypeScript, never in the editor.</summary>
public static class EffectExpressionReader
{
    public static readonly string[] Variables = ["LEVEL", "PROFICIENCY", "STR_MOD", "DEX_MOD", "CON_MOD", "INT_MOD", "WIS_MOD", "CHA_MOD"];
    public static int Validate(string source, string path)
    {
        static void Bad(string where, string what) => throw new ManifestException("E_EXPRESSION", where, what);
        if (string.IsNullOrWhiteSpace(source) || source.Length > 120) Bad(path, "Expression must contain 1–120 characters.");
        var matches = Regex.Matches(source, @"\G\s*(\d+d\d+|\d+|[A-Z_]+|[()+*\-])");
        var tokens = new List<string>();var position = 0;
        foreach (Match m in matches)
        {
            if (m.Index != position) break;
            tokens.Add(m.Groups[1].Value);position += m.Length;
            if (tokens.Count > 64) Bad(path, "Expression exceeds 64 tokens.");
        }
        if (!string.IsNullOrWhiteSpace(source[position..])) Bad(path, "Unexpected expression token.");
        var cursor = 0;var depth = 0;
        (long magnitude,int rolls) Atom()
        {
            if (++depth > 12) Bad(path, "Expression nesting exceeds 12.");
            try
            {
                if (cursor >= tokens.Count) {Bad(path, "Missing expression operand.");return (0,0);}
                var token=tokens[cursor++];
                if(token is "+" or "-")return Atom();
                if(token=="(")
                {
                    var inside=Sum();if(cursor>=tokens.Count || tokens[cursor++]!=")")Bad(path,"Unclosed parenthesis.");return inside;
                }
                if(Regex.IsMatch(token,@"^\d+d\d+$"))
                {
                    var pair=token.Split('d');
                    if(!int.TryParse(pair[0],out var n)||!int.TryParse(pair[1],out var sides)||n<1||n>12||!new[]{2,4,6,8,10,12,20}.Contains(sides))Bad(path,"Invalid bounded dice expression.");
                    return (n*sides,n);
                }
                if(long.TryParse(token,out var value))
                {
                    if(value>1000)Bad(path,"Constants must be 0–1000.");return (value,0);
                }
                if(Variables.Contains(token))return (token=="PROFICIENCY"?100:20,0);
                Bad(path,"Unknown expression variable: "+token);return (0,0);
            }
            finally { depth--; }
        }
        (long magnitude,int rolls) Product()
        {
            var lhs=Atom();while(cursor<tokens.Count && tokens[cursor]=="*")
            {cursor++;var rhs=Atom();lhs=(lhs.magnitude*rhs.magnitude,lhs.rolls+rhs.rolls);if(lhs.magnitude>10000)Bad(path,"Expression magnitude exceeds 10000.");}
            return lhs;
        }
        (long magnitude,int rolls) Sum()
        {
            var lhs=Product();while(cursor<tokens.Count && (tokens[cursor]=="+" || tokens[cursor]=="-"))
            {cursor++;var rhs=Product();lhs=(lhs.magnitude+rhs.magnitude,lhs.rolls+rhs.rolls);if(lhs.magnitude>10000)Bad(path,"Expression magnitude exceeds 10000.");}
            return lhs;
        }
        var result=Sum();if(cursor!=tokens.Count)Bad(path,"Trailing expression token.");
        if(result.magnitude>10000||result.rolls>48)Bad(path,"Expression exceeds magnitude or dice budget.");
        return result.rolls;
    }
}
