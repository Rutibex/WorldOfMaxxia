using System.Text.Json.Nodes;
using System.Diagnostics;
using System.Text.Json;
using MaxxiaMaker.Documents;
using MaxxiaMaker.ProjectModel;
namespace MaxxiaMaker;
/// <summary>MM11 native spell authoring: legacy spell catalog plus bounded composable primitives.</summary>
public sealed class SpellsDatabaseForm : Form
{
    private sealed record RecordRow(string Id,string Name){public override string ToString()=>Name+"  ["+Id+"]";}
    private readonly SpellDatabaseDocument document;
    private readonly string previewScript;
    private readonly List<string> castingClassIds=[];
    private readonly ListBox spells = new(){Dock=DockStyle.Fill,IntegralHeight=false};
    private readonly TextBox search=new(){Width=235,PlaceholderText="Search spells"};
    private readonly Dictionary<string,Control> fields=[];
    private readonly ComboBox caster=new(){DropDownStyle=ComboBoxStyle.DropDownList,Width=260};
    private readonly CheckedListBox available=new(){Dock=DockStyle.Fill,CheckOnClick=true,IntegralHeight=false};
    private readonly CheckedListBox starters=new(){Dock=DockStyle.Fill,CheckOnClick=true,IntegralHeight=false};
    private readonly ListBox effectList=new(){Dock=DockStyle.Fill,IntegralHeight=false};
    private readonly Dictionary<string,Control> effectFields=[];
    private JsonArray effectDraft=[];
    private readonly Label status=new(){AutoSize=true,Padding=new Padding(6)};
    private bool filling,draft;private string? currentId,currentClass;
    public SpellsDatabaseForm(string manifestPath,ProjectManifest project)
    {
        var relative=project.Content.Spells;
        if(string.IsNullOrEmpty(relative))throw new ManifestException("E_SPELL","$.content.spells","Project has no spells database.");
        var root=Path.GetDirectoryName(Path.GetFullPath(manifestPath))!;
        var path=Path.GetFullPath(Path.Combine(root,relative.Replace('/',Path.DirectorySeparatorChar)));
        if(!path.StartsWith(root+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new ManifestException("E_SPELL_PATH","$.content.spells","Database must be project-relative.");
        document=new SpellDatabaseDocument(path);
        previewScript=Path.GetFullPath(Path.Combine(root,"..","scripts","preview-effect-expression.mjs"));
        if(project.Content.Classes is { Length: > 0 } classesRelative)
        {
            var classesFile=Path.GetFullPath(Path.Combine(root,classesRelative.Replace('/',Path.DirectorySeparatorChar)));
            if(!classesFile.StartsWith(root+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new ManifestException("E_CLASS_PATH","$.content.classes","Unsafe classes database path.");
            var definitions=ClassDatabaseReader.Read(File.ReadAllText(classesFile));
            foreach(var item in definitions["classes"]!.AsArray())
                if(item!["casting"] is not null) castingClassIds.Add(item["id"]!.GetValue<string>());
        }
        Text="Maxxia Maker — Spells database";ClientSize=new Size(1140,790);MinimumSize=new Size(840,570);StartPosition=FormStartPosition.CenterParent;AutoScaleMode=AutoScaleMode.Dpi;Font=new Font("Segoe UI",9.5F);
        var left=new Panel{Dock=DockStyle.Left,Width=270};left.Controls.Add(spells);
        var filter=new FlowLayoutPanel{Dock=DockStyle.Top,Height=40};filter.Controls.Add(search);left.Controls.Add(filter);
        var actions=new FlowLayoutPanel{Dock=DockStyle.Bottom,Height=84,WrapContents=true};left.Controls.Add(actions);
        void Button(FlowLayoutPanel panel,string name,Action action){var b=new Button{Text=name,AutoSize=true,MinimumSize=new Size(75,30)};b.Click+=(_,_)=>Safe(action);panel.Controls.Add(b);}
        Button(actions,"New",Create);Button(actions,"New Effects",CreateComposed);Button(actions,"Duplicate",Duplicate);Button(actions,"Delete",Delete);
        var tabs=new TabControl{Dock=DockStyle.Fill};
        var general=new TabPage("Spell definition");var table=new TableLayoutPanel{Dock=DockStyle.Fill,AutoScroll=true,Padding=new Padding(12),ColumnCount=2};table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,180));table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));int row=0;
        void Add(string key,string label,Control control)
        {
            fields[key]=control;table.RowStyles.Add(new RowStyle(SizeType.AutoSize));table.Controls.Add(new Label{Text=label,AutoSize=true,Padding=new Padding(2,7,2,3)},0,row);control.Dock=DockStyle.Top;control.Margin=new Padding(2,3,6,7);table.Controls.Add(control,1,row++);
            switch(control){case TextBox t:t.TextChanged+=(_,_)=>Dirty();break;case ComboBox c:c.SelectedIndexChanged+=(_,_)=>Dirty();break;case NumericUpDown n:n.ValueChanged+=(_,_)=>Dirty();break;case CheckBox chk:chk.CheckedChanged+=(_,_)=>Dirty();break;}
        }
        TextBox ReadText(int max=2000)=>new(){MaxLength=max,Width=420};
        ComboBox Choice(string[] options){var c=new ComboBox{DropDownStyle=ComboBoxStyle.DropDownList,Width=260};c.Items.AddRange(options);return c;}
        Add("id","Permanent ID (read only)",new TextBox{ReadOnly=true});Add("name","Name",ReadText(100));
        Add("classId","Primary class",Choice(castingClassIds.Count>0?castingClassIds.ToArray():["wizard","priest","witch"]));
        Add("level","Minimum level",new NumericUpDown{Minimum=1,Maximum=20});Add("sp","Spell point cost",new NumericUpDown{Maximum=999});
        Add("target","Target",Choice(SpellDatabaseReader.Targets));Add("context","Available during",Choice(SpellDatabaseReader.Contexts));
        Add("effect","Execution mode",Choice(SpellDatabaseReader.Effects));
        Add("behaviorKey","Reusable handler key",new TextBox{ReadOnly=true,Width=420});
        Add("damageType","Damage family",ReadText(30));Add("dice","Dice (optional)",ReadText(20));
        Add("bonus","Bonus ability",Choice(["", "INT", "WIS", "CHA"]));Add("save","Saving throw",Choice(["", "DEX", "WIS", "CON"]));
        Add("saveHalf","Successful save halves",new CheckBox{AutoSize=true});Add("duration","Duration (optional; 0=none)",new NumericUpDown{Maximum=10000});
        Add("description","Description",new TextBox{Multiline=true,Height=96,ScrollBars=ScrollBars.Vertical,MaxLength=2000});
        table.Controls.Add(new Label{Text="MM12: compose damage, healing, resources, condition, cures, revival, party wards, enemy hexes and exploration utilities. Original handler spells remain supported.",AutoSize=true,MaximumSize=new Size(650,0)},1,row);
        general.Controls.Add(table);tabs.TabPages.Add(general);
        // Effect tab edits a detached JSON draft. Apply validates both languages' shared shape
        // and commits one undo step; closing/discard never modifies the authored file.
        var effectTab=new TabPage("Effect primitives");
        var effectSplit=new SplitContainer{Dock=DockStyle.Fill,SplitterDistance=320};
        var effectLeft=new Panel{Dock=DockStyle.Fill,Padding=new Padding(7)};
        var effectButtons=new FlowLayoutPanel{Dock=DockStyle.Bottom,Height=76,WrapContents=true};
        Button(effectButtons,"Add",AddPrimitive);Button(effectButtons,"Remove",RemovePrimitive);
        Button(effectButtons,"Up",()=>MovePrimitive(-1));Button(effectButtons,"Down",()=>MovePrimitive(1));
        Button(effectButtons,"Preview",PreviewPrimitive);
        effectLeft.Controls.Add(effectList);effectLeft.Controls.Add(effectButtons);effectSplit.Panel1.Controls.Add(effectLeft);
        var effectRight=new TableLayoutPanel{Dock=DockStyle.Fill,Padding=new Padding(12),AutoScroll=true,ColumnCount=2};
        effectRight.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute,150));effectRight.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,100));
        int effectRow=0;
        void EffectField(string key,string label,Control control)
        {
            effectFields[key]=control;effectRight.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            effectRight.Controls.Add(new Label{Text=label,AutoSize=true,Padding=new Padding(2,8,0,4)},0,effectRow);
            control.Dock=DockStyle.Top;control.Margin=new Padding(2,3,6,7);effectRight.Controls.Add(control,1,effectRow++);
            if(control is TextBox t)t.TextChanged+=(_,_)=>PrimitiveChanged();
            if(control is ComboBox c)c.SelectedIndexChanged+=(_,_)=>PrimitiveChanged();
            if(control is NumericUpDown n)n.ValueChanged+=(_,_)=>PrimitiveChanged();
        }
        EffectField("operation","Operation",Choice(["damage","heal","resource","condition","cure","revive","ward","hex","reveal","unseal","fold"]));
        EffectField("target","Recipient",Choice(["selected","caster","party","enemies"]));
        EffectField("amount","Amount expression",new TextBox{MaxLength=120});
        EffectField("resource","Change resource",Choice(["hp","sp"]));
        EffectField("damageType","Damage family",Choice(["physical","fire","cold","lightning","poison","arcane","holy","necrotic"]));
        EffectField("conditionId","Condition",Choice(["poisoned","asleep","frightened","cursed","drunk","hungry"]));
        EffectField("wardKind","Party ward",Choice(["stone_skin","mirror_ward","blessing","sheltering_hand","steadfast","briar_mantle","light","glass_eye","borrowed_face"]));
        EffectField("hexKind","Enemy hex",Choice(["ill_omen","binding_thread","sleep_thorns","crooked_bones","bottle_echo","hollow_fear"]));
        EffectField("unit","Duration unit",Choice(["turns","minutes","ticks","persistent"]));
        EffectField("remaining","Duration count",new NumericUpDown{Minimum=1,Maximum=999});
        effectRight.Controls.Add(new Label{Text="Expressions: 2d6 + WIS_MOD, LEVEL * 2, PROFICIENCY + 3.\nAllowed: +, -, *, parentheses, bounded dice, caster modifiers. RNG and formulas run only in the TypeScript engine.\nReapplying a condition replaces that condition on its target.",AutoSize=true,MaximumSize=new Size(490,0)},1,effectRow);
        effectSplit.Panel2.Controls.Add(effectRight);effectTab.Controls.Add(effectSplit);tabs.TabPages.Add(effectTab);
        effectList.SelectedIndexChanged+=(_,_)=>LoadPrimitive();
        var accessTab=new TabPage("Class spell access");var accessPanel=new TableLayoutPanel{Dock=DockStyle.Fill,ColumnCount=2,RowCount=3,Padding=new Padding(12)};
        accessPanel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,50));accessPanel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent,50));
        accessPanel.RowStyles.Add(new RowStyle(SizeType.Absolute,42));accessPanel.RowStyles.Add(new RowStyle(SizeType.Absolute,32));accessPanel.RowStyles.Add(new RowStyle(SizeType.Percent,100));
        var top=new FlowLayoutPanel{Dock=DockStyle.Fill};top.Controls.Add(new Label{Text="Casting class:",AutoSize=true,Padding=new Padding(0,7,0,0)});top.Controls.Add(caster);
        var addCaster=new Button{Text="Add caster class",AutoSize=true};addCaster.Click+=(_,_)=>Safe(AddCasterClass);top.Controls.Add(addCaster);
        accessPanel.Controls.Add(top,0,0);accessPanel.SetColumnSpan(top,2);
        accessPanel.Controls.Add(new Label{Text="Available to learn",AutoSize=true},0,1);accessPanel.Controls.Add(new Label{Text="Known at game start (max 12)",AutoSize=true},1,1);
        accessPanel.Controls.Add(available,0,2);accessPanel.Controls.Add(starters,1,2);accessTab.Controls.Add(accessPanel);tabs.TabPages.Add(accessTab);
        var bottom=new FlowLayoutPanel{Dock=DockStyle.Bottom,AutoSize=true,Padding=new Padding(9)};
        Button(bottom,"Apply",Apply);Button(bottom,"Undo",Undo);Button(bottom,"Redo",Redo);Button(bottom,"Save",Save);Button(bottom,"Close",Close);bottom.Controls.Add(status);
        Controls.Add(tabs);Controls.Add(left);Controls.Add(bottom);
        search.TextChanged+=(_,_)=>RefreshSpellList();spells.SelectedIndexChanged+=(_,_)=>SelectSpell();caster.SelectedIndexChanged+=(_,_)=>SelectClass();
        available.ItemCheck+=(_,_)=>Dirty();starters.ItemCheck+=(_,_)=>Dirty();
        FormClosing+=OnClosing;RefreshAll();
    }
    private void Safe(Action action){try{action();}catch(Exception ex){MessageBox.Show(this,ex.Message,"Spells database",MessageBoxButtons.OK,MessageBoxIcon.Warning);}}
    private void Dirty(){if(!filling){draft=true;UpdateStatus();}}
    private void UpdateStatus(){status.Text=document.HasExternalChange?"External modification — save blocked":draft?"Unapplied edits":document.IsDirty?"Accepted edits — save needed":"Saved";}
    private JsonArray Entries=>document.Model["spells"]!.AsArray();
    private void RefreshSpellList(string? choose=null)
    {
        filling=true;try
        {
            choose??=currentId;spells.Items.Clear();foreach(var node in Entries)
            {
                var id=node!["id"]!.GetValue<string>();var name=node["name"]!.GetValue<string>();
                if((id+" "+name).Contains(search.Text,StringComparison.OrdinalIgnoreCase))spells.Items.Add(new RecordRow(id,name));
            }
            if(spells.Items.Count>0)spells.SelectedIndex=Math.Max(0,spells.Items.Cast<RecordRow>().ToList().FindIndex(x=>x.Id==choose));
        }finally{filling=false;}
        LoadSpell();
    }
    private void RefreshAll(string? choose=null)
    {
        var prior=currentClass;filling=true;
        try{caster.Items.Clear();foreach(var key in document.Model["classAccess"]!.AsObject().Select(x=>x.Key).OrderBy(x=>x))caster.Items.Add(key);if(caster.Items.Count>0)caster.SelectedItem=prior is not null&&caster.Items.Contains(prior)?prior:caster.Items[0];}
        finally{filling=false;}
        RefreshSpellList(choose);LoadClass();UpdateStatus();
    }
    private void SelectSpell(){if(filling)return;var target=(spells.SelectedItem as RecordRow)?.Id;if(target==currentId)return;if(!ResolveDraft()){filling=true;foreach(RecordRow row in spells.Items)if(row.Id==currentId){spells.SelectedItem=row;break;}filling=false;return;}LoadSpell();}
    private JsonObject? SelectedSpell()=>Entries.FirstOrDefault(n=>n!["id"]!.GetValue<string>()==currentId) as JsonObject;
    private void LoadSpell()
    {
        currentId=(spells.SelectedItem as RecordRow)?.Id;var entry=SelectedSpell();filling=true;
        try
        {
            foreach(var (key,ctrl) in fields)
            {
                var node=entry?[key];string raw="";if(node is not null)try{raw=node.GetValue<string>();}catch{raw=node.ToJsonString();}
                switch(ctrl)
                {
                    case TextBox t:t.Text=raw;break;
                    case ComboBox c:c.SelectedItem=raw;if(c.SelectedIndex<0)c.SelectedIndex=0;break;
                    case NumericUpDown n:n.Value=decimal.TryParse(raw,out var val)?Math.Clamp(val,n.Minimum,n.Maximum):n.Minimum;break;
                    case CheckBox b:b.Checked=raw=="true";break;
                }
                ctrl.Enabled=entry is not null;
            }
            // For predefined handlers, prevent choosing a different mechanical family in this pass.
            bool composed=entry?["effect"]?.GetValue<string>()=="composed";
            fields["target"].Enabled=composed;fields["context"].Enabled=composed;fields["effect"].Enabled=false;
            effectDraft=composed?entry!["effects"]!.AsArray().DeepClone().AsArray():new JsonArray();
            RefreshEffects();
            draft=false;
        }finally{filling=false;}
        UpdateStatus();
    }
    private void SelectClass(){if(filling)return;if(!ResolveDraft()){filling=true;caster.SelectedItem=currentClass;filling=false;return;}LoadClass();}
    private void LoadClass()
    {
        currentClass=caster.SelectedItem?.ToString();filling=true;
        try
        {
            available.Items.Clear();starters.Items.Clear();if(currentClass is null)return;
            var access=document.Model["classAccess"]![currentClass]!.AsObject();var allowed=access["spellIds"]!.AsArray().Select(v=>v!.GetValue<string>()).ToHashSet();var initial=access["starterSpellIds"]!.AsArray().Select(v=>v!.GetValue<string>()).ToHashSet();
            foreach(var spell in Entries)
            {
                var id=spell!["id"]!.GetValue<string>();var display=spell["name"]!.GetValue<string>()+" ["+id+"]";
                available.Items.Add(display,allowed.Contains(id));starters.Items.Add(display,initial.Contains(id));
            }
        }finally{filling=false;}
        UpdateStatus();
    }
    private string ItemId(string s){var i=s.LastIndexOf('[');return i>=0?s[(i+1)..^1]:s;}
    private void AddCasterClass()
    {
        if(!ResolveDraft())return;
        var existing=document.Model["classAccess"]!.AsObject();
        var options=castingClassIds.Where(id=>!existing.ContainsKey(id)).ToArray();
        if(options.Length==0){MessageBox.Show(this,"All casting classes in this project already have spell-access lists.");return;}
        using var dlg=new Form{Text="Add spellcasting class",Width=380,Height=175,StartPosition=FormStartPosition.CenterParent,FormBorderStyle=FormBorderStyle.FixedDialog,MaximizeBox=false,MinimizeBox=false};
        var choice=new ComboBox{Dock=DockStyle.Top,DropDownStyle=ComboBoxStyle.DropDownList};choice.Items.AddRange(options);choice.SelectedIndex=0;
        var ok=new Button{Text="Add",DialogResult=DialogResult.OK,Dock=DockStyle.Bottom};dlg.Controls.Add(choice);dlg.Controls.Add(ok);dlg.AcceptButton=ok;
        if(dlg.ShowDialog(this)!=DialogResult.OK)return;
        var id=choice.SelectedItem!.ToString()!;var root=document.Model;
        root["classAccess"]![id]=new JsonObject{["spellIds"]=new JsonArray(),["starterSpellIds"]=new JsonArray()};
        document.Apply(root.ToJsonString());currentClass=id;RefreshAll(currentId);
    }
    private void Apply()
    {
        if(!draft)return;var root=document.Model;
        if(currentId is not null)
        {
            var record=root["spells"]!.AsArray().First(x=>x!["id"]!.GetValue<string>()==currentId)!.AsObject();
            foreach(var (key,ctrl)in fields)
            {
                if(key is "id" or "effect" or "behaviorKey" || (record["effect"]?.GetValue<string>()!="composed" && key is "target" or "context"))continue;
                switch(ctrl)
                {
                    case TextBox t:if(key is "dice" or "damageType") {if(string.IsNullOrWhiteSpace(t.Text))record.Remove(key);else record[key]=t.Text.Trim();}else record[key]=t.Text.Trim();break;
                    case ComboBox c:if(key is "save" or "bonus") {if(c.SelectedIndex<=0)record.Remove(key);else record[key]=c.SelectedItem?.ToString();}else record[key]=c.SelectedItem?.ToString();break;
                    case NumericUpDown n:if(key=="duration"&&n.Value==0)record.Remove(key);else record[key]=(int)n.Value;break;
                    case CheckBox b:record[key]=b.Checked;break;
                }
            }
            if(record["effect"]?.GetValue<string>()=="composed")record["effects"]=effectDraft.DeepClone();
        }
        if(currentClass is not null)
        {
            var access=root["classAccess"]![currentClass]!.AsObject();var allowed=new JsonArray();var initial=new JsonArray();
            foreach(var o in available.CheckedItems)allowed.Add(ItemId(o!.ToString()!));
            foreach(var o in starters.CheckedItems)initial.Add(ItemId(o!.ToString()!));
            access["spellIds"]=allowed;access["starterSpellIds"]=initial;
        }
        SpellDatabaseReader.Validate(root);document.Apply(root.ToJsonString());draft=false;RefreshAll(currentId);
    }
    private bool ResolveDraft(){if(!draft)return true;var r=MessageBox.Show(this,"Apply pending changes? Yes=Apply, No=Discard, Cancel=Keep editing","Unapplied spell edits",MessageBoxButtons.YesNoCancel);if(r==DialogResult.Cancel)return false;if(r==DialogResult.Yes)Apply();else RefreshAll(currentId);return true;}
    private void Create(){if(!ResolveDraft())return;var template=SelectedSpell()??Entries[0]!.AsObject();var root=document.Model;var clone=template.DeepClone().AsObject();var id="spell_custom_"+Guid.NewGuid().ToString("N")[..12];clone["id"]=id;clone["name"]="New Spell";root["spells"]!.AsArray().Add(clone);document.Apply(root.ToJsonString());RefreshAll(id);}
    private bool IsComposed()=>SelectedSpell()?["effect"]?.GetValue<string>()=="composed";
    private void RefreshEffects(int select=0)
    {
        filling=true;try
        {
            effectList.Items.Clear();foreach(var node in effectDraft)
            {
                var op=node?["operation"]?.GetValue<string>()??"?";var t=node?["target"]?.GetValue<string>()??"?";
                effectList.Items.Add($"{op} → {t}");
            }
            if(effectList.Items.Count>0)effectList.SelectedIndex=Math.Clamp(select,0,effectList.Items.Count-1);
        }finally{filling=false;}
        LoadPrimitive();
    }
    private void LoadPrimitive()
    {
        var node=effectList.SelectedIndex>=0&&effectList.SelectedIndex<effectDraft.Count?effectDraft[effectList.SelectedIndex] as JsonObject:null;
        filling=true;try
        {
            foreach(var (key,control) in effectFields)
            {
                var value=node?[key]?.ToString()??"";
                if(control is ComboBox combo)
                {
                    combo.SelectedItem=value;if(combo.SelectedIndex<0)combo.SelectedIndex=0;
                }
                if(control is TextBox textbox)textbox.Text=value;
                if(control is NumericUpDown numeric)numeric.Value=int.TryParse(value,out var n)?Math.Clamp(n,(int)numeric.Minimum,(int)numeric.Maximum):1;
                control.Enabled=node is not null;
            }
            if(node is not null){var op=node["operation"]?.GetValue<string>();
                effectFields["amount"].Enabled=op is "damage" or "heal" or "resource";
                effectFields["resource"].Enabled=op=="resource";
                effectFields["damageType"].Enabled=op=="damage";
                effectFields["conditionId"].Enabled=op is "condition" or "cure";
                effectFields["wardKind"].Enabled=op=="ward";
                effectFields["hexKind"].Enabled=op=="hex";
                effectFields["unit"].Enabled=op is "condition" or "ward" or "hex" or "reveal";
                effectFields["remaining"].Enabled=(op is "condition" or "ward" or "hex" or "reveal")&&node["unit"]?.GetValue<string>()!="persistent";
            }
        }finally{filling=false;}
    }
    private void PrimitiveChanged()
    {
        if(filling||!IsComposed()||effectList.SelectedIndex<0)return;
        var idx=effectList.SelectedIndex;var original=effectDraft[idx]!.AsObject();
        string ChoiceValue(string key)=>((ComboBox)effectFields[key]).SelectedItem?.ToString()??"";
        var op=ChoiceValue("operation");var target=ChoiceValue("target");
        var primitive=new JsonObject{["operation"]=op,["target"]=target};
        if(op is "condition" or "cure")primitive["conditionId"]=ChoiceValue("conditionId");
        if(op=="ward")primitive["wardKind"]=ChoiceValue("wardKind");
        if(op=="hex")primitive["hexKind"]=ChoiceValue("hexKind");
        if(op is "condition" or "ward" or "hex" or "reveal")
        {
            var unit=op=="hex"?"turns":op is "ward" or "reveal"?"minutes":ChoiceValue("unit");
            primitive["unit"]=unit;
            var count=(int)((NumericUpDown)effectFields["remaining"]).Value;
            if(op=="ward")count=Math.Min(count,ChoiceValue("wardKind") is "light"?60:ChoiceValue("wardKind") is "briar_mantle"?5:ChoiceValue("wardKind") is "steadfast"?3:30);
            if(op=="hex")count=Math.Min(count,ChoiceValue("hexKind") is "ill_omen" or "crooked_bones"?3:ChoiceValue("hexKind") is "hollow_fear" or "bottle_echo"?2:1);
            if(op=="reveal")count=Math.Min(count,30);
            primitive["remaining"]=unit=="persistent"?null:count;
        }
        if(op is "damage" or "heal" or "resource")
        {
            primitive["amount"]=((TextBox)effectFields["amount"]).Text;
            if(op=="resource")primitive["resource"]=ChoiceValue("resource");
            if(op=="damage")primitive["damageType"]=ChoiceValue("damageType");
        }
        effectDraft[idx]=primitive;
        filling=true;effectList.Items[idx]=$"{op} → {target}";filling=false;
        Dirty();
        if(original["operation"]?.GetValue<string>()!=op||original["unit"]?.ToString()!=primitive["unit"]?.ToString())LoadPrimitive();
    }
    private void AddPrimitive()
    {
        if(!IsComposed()){MessageBox.Show(this,"Create a New Effects spell to author primitives; legacy spells keep their original handlers.");return;}
        var target=SelectedSpell()!["target"]!.GetValue<string>();
        JsonObject primitive=target=="enemy"?new(){["operation"]="damage",["target"]="selected",["amount"]="1d6",["damageType"]="arcane"}:
            target=="enemies"?new(){["operation"]="damage",["target"]="enemies",["amount"]="1d6",["damageType"]="arcane"}:
            new(){["operation"]="heal",["target"]=target=="ally"?"selected":"caster",["amount"]="1d6"};
        effectDraft.Add(primitive);Dirty();RefreshEffects(effectDraft.Count-1);
    }
    private void PreviewPrimitive()
    {
        if(effectList.SelectedIndex<0||!IsComposed())return;
        var operation=((ComboBox)effectFields["operation"]).SelectedItem?.ToString();
        if(operation is not ("damage" or "heal" or "resource")){MessageBox.Show(this,"This effect uses typed parameters rather than an amount formula.","Effect preview");return;}
        if(!File.Exists(previewScript)){MessageBox.Show(this,"The TypeScript preview helper was not found. This editor expects the complete source checkout.","Preview unavailable");return;}
        var expression=((TextBox)effectFields["amount"]).Text;
        var start=new ProcessStartInfo("node") {UseShellExecute=false,RedirectStandardOutput=true,RedirectStandardError=true,CreateNoWindow=true,WorkingDirectory=Path.GetDirectoryName(Path.GetDirectoryName(previewScript))!};
        start.ArgumentList.Add("--experimental-strip-types");start.ArgumentList.Add(previewScript);start.ArgumentList.Add(expression);
        using var child=Process.Start(start)??throw new InvalidOperationException("Unable to start the Node.js preview helper.");
        var output=child.StandardOutput.ReadToEnd();var error=child.StandardError.ReadToEnd();
        if(!child.WaitForExit(5000)){child.Kill(entireProcessTree:true);throw new TimeoutException("Expression preview exceeded 5 seconds.");}
        if(child.ExitCode!=0)throw new InvalidOperationException("Expression preview failed: "+error.Trim());
        using var result=JsonDocument.Parse(output);var root=result.RootElement;
        MessageBox.Show(this,$"Sample result: {root.GetProperty("value").GetInt32()}\nDice rolls: {root.GetProperty("rolls").GetInt32()}\n\nSample caster: LEVEL 3, PROFICIENCY 2, INT/WIS_MOD +2, DEX/CON/CHA_MOD +1, STR_MOD 0.\n\nThe preview uses the canonical TypeScript evaluator and a separate deterministic seed; game RNG is untouched.","Effect amount preview");
    }
    private void RemovePrimitive()
    {
        if(!IsComposed()||effectList.SelectedIndex<0||effectDraft.Count<=1)return;
        var idx=effectList.SelectedIndex;effectDraft.RemoveAt(idx);Dirty();RefreshEffects(Math.Max(0,idx-1));
    }
    private void MovePrimitive(int delta)
    {
        var idx=effectList.SelectedIndex;var dest=idx+delta;
        if(!IsComposed()||idx<0||dest<0||dest>=effectDraft.Count)return;
        var clone=effectDraft[idx]!.DeepClone();effectDraft.RemoveAt(idx);effectDraft.Insert(dest,clone);Dirty();RefreshEffects(dest);
    }
    private void CreateComposed()
    {
        if(!ResolveDraft())return;
        var root=document.Model;var id="spell_custom_"+Guid.NewGuid().ToString("N")[..12];
        var primary=currentClass??root["classAccess"]!.AsObject().FirstOrDefault().Key;
        if(string.IsNullOrEmpty(primary))throw new InvalidOperationException("Add a casting class before creating an Effects spell.");
        var newSpell=new JsonObject{["id"]=id,["name"]="New Effects Spell",["description"]="A project-authored spell.",["classId"]=primary,["level"]=1,["sp"]=2,["target"]="ally",["context"]="both",["effect"]="composed",["behaviorKey"]="composed",
            ["effects"]=new JsonArray(new JsonObject{["operation"]="heal",["target"]="selected",["amount"]="1d6+WIS_MOD"})};
        root["spells"]!.AsArray().Add(newSpell);
        root["classAccess"]![primary]!["spellIds"]!.AsArray().Add(id);
        document.Apply(root.ToJsonString());RefreshAll(id);
    }
    private void Duplicate(){if(!ResolveDraft())return;var existing=SelectedSpell();if(existing is null)return;var root=document.Model;var clone=existing.DeepClone().AsObject();var id="spell_custom_"+Guid.NewGuid().ToString("N")[..12];clone["id"]=id;clone["name"]=existing["name"]!.GetValue<string>()+" Copy";root["spells"]!.AsArray().Add(clone);
        // The copied spell is offered to every class with access to the original, without being automatically learned at startup.
        foreach(var (_,a)in root["classAccess"]!.AsObject())if(a!["spellIds"]!.AsArray().Any(s=>s!.GetValue<string>()==currentId))a["spellIds"]!.AsArray().Add(id);
        document.Apply(root.ToJsonString());RefreshAll(id);
    }
    private void Delete(){if(!ResolveDraft())return;var record=SelectedSpell();if(record is null)return;var id=currentId!;var used=document.Model["classAccess"]!.AsObject().Where(x=>x.Value!["spellIds"]!.AsArray().Any(y=>y!.GetValue<string>()==id)).Select(x=>x.Key).ToArray();
        if(used.Length>0){MessageBox.Show(this,"Remove references from these classes before deleting: "+string.Join(", ",used),"Where Used",MessageBoxButtons.OK,MessageBoxIcon.Information);return;}
        if(MessageBox.Show(this,"Delete "+id+"? Existing saves referencing it will need migration.","Delete spell",MessageBoxButtons.YesNo,MessageBoxIcon.Warning)!=DialogResult.Yes)return;
        var root=document.Model;var entry=root["spells"]!.AsArray().First(x=>x!["id"]!.GetValue<string>()==id);root["spells"]!.AsArray().Remove(entry);document.Apply(root.ToJsonString());currentId=null;RefreshAll();}
    private void Undo(){if(!ResolveDraft())return;document.Undo();RefreshAll();}
    private void Redo(){if(!ResolveDraft())return;document.Redo();RefreshAll();}
    private void Save(){if(!ResolveDraft())return;document.Save();UpdateStatus();}
    private void OnClosing(object? sender,FormClosingEventArgs e)
    {
        if(!ResolveDraft()){e.Cancel=true;return;}if(!document.IsDirty)return;
        var reply=MessageBox.Show(this,"Save spell database edits?","Unsaved spells",MessageBoxButtons.YesNoCancel);
        if(reply==DialogResult.Cancel){e.Cancel=true;return;}if(reply==DialogResult.Yes)try{Save();}catch(Exception ex){MessageBox.Show(this,ex.Message);e.Cancel=true;}
    }
    protected override bool ProcessCmdKey(ref Message message,Keys key){if(key==(Keys.Control|Keys.S)){Safe(Save);return true;}if(key==(Keys.Control|Keys.Z)){Safe(Undo);return true;}if(key==(Keys.Control|Keys.Y)){Safe(Redo);return true;}return base.ProcessCmdKey(ref message,key);}
}
