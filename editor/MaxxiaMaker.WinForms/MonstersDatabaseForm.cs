using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using MaxxiaMaker.Documents;
using MaxxiaMaker.ProjectModel;
namespace MaxxiaMaker;

/// <summary>MM13 database authoring: stats, attacks, saving throws, resistances and existing animation atlases.</summary>
public sealed class MonstersDatabaseForm : Form
{
    private sealed record Row(string Id,string Name){public override string ToString()=>Name+"  ["+Id+"]";}
    private readonly MonsterDatabaseDocument document;
    private readonly ListBox list=new(){Dock=DockStyle.Fill};
    private readonly TextBox search=new(){Dock=DockStyle.Top,PlaceholderText="Search monsters by name or ID"};
    private readonly Dictionary<string,Control> fields=[];
    private readonly DataGridView attacks=new(){Dock=DockStyle.Fill,AllowUserToAddRows=false,AllowUserToDeleteRows=false,AutoSizeColumnsMode=DataGridViewAutoSizeColumnsMode.Fill,RowHeadersVisible=false};
    private readonly DataGridView resistances=new(){Dock=DockStyle.Fill,AllowUserToAddRows=false,AllowUserToDeleteRows=false,AutoSizeColumnsMode=DataGridViewAutoSizeColumnsMode.Fill,RowHeadersVisible=false};
    private readonly Label status=new(){AutoSize=true};
    private readonly PictureBox picture=new(){Dock=DockStyle.Top,Height=220,SizeMode=PictureBoxSizeMode.Zoom,BackColor=Color.FromArgb(38,38,42)};
    private readonly string projectRoot;
    private readonly string? encounterGroupsPath;
    private readonly Label preview=new(){Dock=DockStyle.Bottom,AutoSize=true,Text="Visuals select one of the original nine illustrated animation atlases."};
    private string? selectedId;private bool filling,draft;
    public MonstersDatabaseForm(string manifestPath,ProjectManifest project)
    {
        var relative=project.Content.Monsters??throw new ManifestException("E_MONSTERS","$.content.monsters","Declare the project monsters database before editing.");
        var folder=Path.GetDirectoryName(Path.GetFullPath(manifestPath))!;
        var file=Path.GetFullPath(Path.Combine(folder,relative.Replace('/',Path.DirectorySeparatorChar)));
        if(!file.StartsWith(folder+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new ManifestException("E_MONSTERS_PATH","$.content.monsters","Monster database must remain within the project.");
        projectRoot=folder;document=new MonsterDatabaseDocument(file);
        if(project.Content.EncounterGroups is { Length:>0 } groupFile){var candidate=Path.GetFullPath(Path.Combine(folder,groupFile.Replace('/',Path.DirectorySeparatorChar)));if(candidate.StartsWith(folder+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))encounterGroupsPath=candidate;}
        Text="Maxxia Maker — Monsters database";ClientSize=new Size(1140,780);MinimumSize=new Size(820,570);StartPosition=FormStartPosition.CenterParent;AutoScaleMode=AutoScaleMode.Dpi;
        var split=new SplitContainer{Dock=DockStyle.Fill,SplitterDistance=270,Panel1MinSize=190,Panel2MinSize=460};
        var left=new Panel{Dock=DockStyle.Fill};
        var buttons=new FlowLayoutPanel{Dock=DockStyle.Bottom,Height=90,AutoScroll=true};
        void Button(Control parent,string text,Action action){var b=new Button{Text=text,AutoSize=true};b.Click+=(_,_)=>Safe(action);parent.Controls.Add(b);}
        Button(buttons,"New",New);Button(buttons,"Duplicate",Duplicate);Button(buttons,"Delete",Delete);Button(buttons,"Where Used",WhereUsed);
        left.Controls.Add(list);left.Controls.Add(search);left.Controls.Add(buttons);split.Panel1.Controls.Add(left);
        var pages=new TabControl{Dock=DockStyle.Fill};
        var general=new TabPage("General & attributes");var table=new TableLayoutPanel{Dock=DockStyle.Fill,AutoScroll=true,Padding=new Padding(12),ColumnCount=4};
        for(var i=0;i<4;i++)table.ColumnStyles.Add(new ColumnStyle(i%2==0?SizeType.Absolute:SizeType.Percent,i%2==0?135:50));
        void Field(int row,int column,string key,string label,Control ctrl)
        {
            table.Controls.Add(new Label{Text=label,AutoSize=true,Dock=DockStyle.Fill},column,row);ctrl.Dock=DockStyle.Fill;table.Controls.Add(ctrl,column+1,row);fields[key]=ctrl;
            if(ctrl is TextBox t)t.TextChanged+=(_,_)=>Dirty();if(ctrl is NumericUpDown n)n.ValueChanged+=(_,_)=>Dirty();if(ctrl is ComboBox c)c.SelectedIndexChanged+=(_,_)=>Dirty();if(ctrl is CheckBox ch)ch.CheckedChanged+=(_,_)=>Dirty();
        }
        static NumericUpDown Num(int min,int max)=>new(){Minimum=min,Maximum=max,ThousandsSeparator=true};
        static ComboBox Choice(IEnumerable<string> values){var cb=new ComboBox{DropDownStyle=ComboBoxStyle.DropDownList};cb.Items.AddRange(values.Cast<object>().ToArray());return cb;}
        Field(0,0,"id","Permanent ID",new TextBox{ReadOnly=true});Field(0,2,"name","Display name",new TextBox{MaxLength=100});
        Field(1,0,"hp","Hit points",Num(1,100000));Field(1,2,"defense","Defense",Num(0,200));
        Field(2,0,"attack","Attack bonus",Num(-100,200));Field(2,2,"damage","Damage dice",new TextBox{MaxLength=12});
        Field(3,0,"speed","Initiative speed",Num(0,200));Field(3,2,"xp","XP reward",Num(0,1000000));
        Field(4,0,"gold","Corpse gold",Num(0,1000000));Field(4,2,"symbol","Map symbol",new TextBox{MaxLength=8});
        Field(5,0,"DEX","Save: DEX",Num(1,100));Field(5,2,"WIS","Save: WIS",Num(1,100));
        Field(6,0,"CON","Save: CON",Num(1,100));Field(6,2,"undead","Undead",new CheckBox());
        Field(7,0,"visualId","Animation set",Choice(MonsterDatabaseReader.Visuals));Field(7,2,"aiPattern","Special pattern",Choice(["standard","resonance"]));
        general.Controls.Add(table);pages.TabPages.Add(general);
        var ai=new TabPage("Weighted attack choices");
        attacks.Columns.Add(new DataGridViewTextBoxColumn{Name="attackId",HeaderText="Attack ID"});
        attacks.Columns.Add(new DataGridViewComboBoxColumn{Name="kind",HeaderText="Action",DataSource=new[]{"strike","spectral"}});
        attacks.Columns.Add(new DataGridViewComboBoxColumn{Name="when",HeaderText="Condition",DataSource=new[]{"always","odd_round","even_round","hurt","healthy"}});
        attacks.Columns.Add(new DataGridViewTextBoxColumn{Name="weight",HeaderText="Weight"});
        attacks.Columns.Add(new DataGridViewTextBoxColumn{Name="bonus",HeaderText="Damage bonus"});
        var controls=new FlowLayoutPanel{Dock=DockStyle.Bottom,Height=44};Button(controls,"Add attack",()=>{attacks.Rows.Add("new_attack","strike","always",1,0);Dirty();});Button(controls,"Remove selected",()=>{if(attacks.CurrentRow is { } row){attacks.Rows.Remove(row);Dirty();}});
        ai.Controls.Add(attacks);ai.Controls.Add(controls);pages.TabPages.Add(ai);
        var resist=new TabPage("Damage resistances & artwork");
        resistances.Columns.Add(new DataGridViewTextBoxColumn{Name="damageType",HeaderText="Damage family",ReadOnly=true});resistances.Columns.Add(new DataGridViewTextBoxColumn{Name="reduction",HeaderText="Reduction percent (0–100)"});
        foreach(var kind in MonsterDatabaseReader.DamageTypes)resistances.Rows.Add(kind,0);
        resist.Controls.Add(resistances);resist.Controls.Add(preview);resist.Controls.Add(picture);pages.TabPages.Add(resist);
        attacks.CellValueChanged+=(_,_)=>Dirty();resistances.CellValueChanged+=(_,_)=>Dirty();attacks.CurrentCellDirtyStateChanged+=(_,_)=>{if(attacks.IsCurrentCellDirty)attacks.CommitEdit(DataGridViewDataErrorContexts.Commit);};
        var footer=new FlowLayoutPanel{Dock=DockStyle.Bottom,Height=48,Padding=new Padding(7)};
        Button(footer,"Apply",Apply);Button(footer,"Undo",()=>{if(Resolve()){document.Undo();Refresh();}});Button(footer,"Redo",()=>{if(Resolve()){document.Redo();Refresh();}});Button(footer,"Save",Save);Button(footer,"Close",Close);footer.Controls.Add(status);
        split.Panel2.Controls.Add(pages);Controls.Add(split);Controls.Add(footer);
        search.TextChanged+=(_,_)=>RefreshList();
        list.SelectedIndexChanged+=(_,_)=>{if(filling)return;if(!Resolve()){RefreshList();return;}LoadSelected();};
        FormClosing+=OnClosing;Refresh();
    }
    private JsonArray Records=>document.Model["monsters"]!.AsArray();
    private JsonObject Selected=>Records.First(v=>v!["id"]!.GetValue<string>()==selectedId)!.AsObject();
    private void Safe(Action action){try{action();}catch(Exception ex){MessageBox.Show(this,ex.Message,"Monsters database",MessageBoxButtons.OK,MessageBoxIcon.Warning);}}
    private void Dirty(){if(!filling){draft=true;ShowStatus();}}
    private void ShowStatus()=>status.Text=document.HasExternalChange?"External change!":draft?"Unapplied changes":document.IsDirty?"Save required":"Saved";
    private void Refresh(){RefreshList();}
    private void RefreshList(string? pick=null)
    {
        filling=true;var selected=pick??selectedId;list.Items.Clear();
        foreach(var m in Records){var id=m!["id"]!.GetValue<string>();var name=m["name"]!.GetValue<string>();if(search.Text.Length==0||(name+" "+id).Contains(search.Text,StringComparison.OrdinalIgnoreCase))list.Items.Add(new Row(id,name));}
        var item=list.Items.Cast<Row>().FirstOrDefault(x=>x.Id==selected);list.SelectedItem=item??list.Items.Cast<Row>().FirstOrDefault();filling=false;LoadSelected();
    }
    private void LoadSelected()
    {
        if(list.SelectedItem is not Row row){selectedId=null;return;}selectedId=row.Id;var m=Selected;
        filling=true;
        foreach(var (key,ctrl) in fields)
        {
            JsonNode? node=key is "DEX" or "WIS" or "CON"?m["attributes"]?[key]:m[key];
            if(ctrl is TextBox t)t.Text=node?.ToString()??"";
            else if(ctrl is NumericUpDown n)n.Value=Math.Clamp(node?.GetValue<int>()??0,(int)n.Minimum,(int)n.Maximum);
            else if(ctrl is CheckBox cb)cb.Checked=node?.GetValue<bool>()??false;
            else if(ctrl is ComboBox combo)combo.SelectedItem=node?.ToString();
        }
        attacks.Rows.Clear();foreach(var a in m["abilities"]!.AsArray())attacks.Rows.Add(a!["id"]!.ToString(),a["kind"]!.ToString(),a["when"]!.ToString(),a["weight"]!.ToString(),a["bonusDamage"]!.ToString());
        foreach(DataGridViewRow dr in resistances.Rows)dr.Cells[1].Value=m["resistances"]?[dr.Cells[0].Value!.ToString()!]?.ToString()??"0";
        ShowArt(m["visualId"]!.ToString());
        preview.Text=$"Animation set: {m["visualId"]}. Uses the existing illustrated idle, attack, hurt and death frames. New animation authoring is MM22.";
        filling=false;draft=false;ShowStatus();
    }
    private void ShowArt(string key)
    {
        var path=key=="dust_imp"?"assets/art/dust-imp.png":"assets/art/enemies/"+key.Replace('_','-')+".png";
        var file=Path.Combine(projectRoot,path.Replace('/',Path.DirectorySeparatorChar));
        var old=picture.Image;picture.Image=null;old?.Dispose();
        if(!File.Exists(file))return;
        try{using var stream=File.OpenRead(file);using var original=Image.FromStream(stream);picture.Image=new Bitmap(original);}
        catch(Exception){/* Resource diagnostics are handled by the catalogue browser. */}
    }
    private bool Resolve()
    {
        if(!draft)return true;
        var result=MessageBox.Show(this,"Apply edits to this monster?","Unapplied monster changes",MessageBoxButtons.YesNoCancel);
        if(result==DialogResult.Cancel)return false;if(result==DialogResult.Yes){try{Apply();}catch(Exception ex){MessageBox.Show(this,ex.Message);return false;}return !draft;}draft=false;return true;
    }
    private void Apply()
    {
        if(selectedId is null)return;attacks.EndEdit();resistances.EndEdit();
        var root=document.Model;var m=root["monsters"]!.AsArray().First(v=>v!["id"]!.ToString()==selectedId)!.AsObject();
        foreach(var (key,ctrl) in fields)
        {
            JsonNode? node=ctrl switch{TextBox t=>JsonValue.Create(t.Text),NumericUpDown n=>JsonValue.Create((int)n.Value),ComboBox cb=>JsonValue.Create(cb.SelectedItem?.ToString()??""),CheckBox cb=>JsonValue.Create(cb.Checked),_=>null};
            if(key is "DEX" or "WIS" or "CON")m["attributes"]![key]=node;else m[key]=node;
        }
        var abilities=new JsonArray();foreach(DataGridViewRow row in attacks.Rows){if(row.IsNewRow)continue;
            var ability=new JsonObject{["id"]=Convert.ToString(row.Cells[0].Value)??"",["kind"]=Convert.ToString(row.Cells[1].Value)??"",["when"]=Convert.ToString(row.Cells[2].Value)??"",["weight"]=int.Parse(Convert.ToString(row.Cells[3].Value)??"0"),["bonusDamage"]=int.Parse(Convert.ToString(row.Cells[4].Value)??"0")};abilities.Add(ability);
        }m["abilities"]=abilities;
        var res=new JsonObject();foreach(DataGridViewRow row in resistances.Rows){var amount=int.Parse(Convert.ToString(row.Cells[1].Value)??"0");if(amount>0)res[Convert.ToString(row.Cells[0].Value)!]=amount;}m["resistances"]=res;
        document.Apply(root.ToJsonString());draft=false;RefreshList(selectedId);
    }
    private void New(){if(!Resolve())return;var root=document.Model;var rows=root["monsters"]!.AsArray();var id="monster_"+Guid.NewGuid().ToString("N")[..12];var clone=rows[0]!.DeepClone().AsObject();clone["id"]=id;clone["name"]="New Monster";clone["visualId"]="dust_imp";rows.Add(clone);document.Apply(root.ToJsonString());RefreshList(id);}
    private void Duplicate(){if(!Resolve()||selectedId is null)return;var root=document.Model;var rows=root["monsters"]!.AsArray();var clone=rows.First(v=>v!["id"]!.ToString()==selectedId)!.DeepClone().AsObject();var id="monster_"+Guid.NewGuid().ToString("N")[..12];clone["id"]=id;clone["name"]=clone["name"]!.ToString()+" Copy";rows.Add(clone);document.Apply(root.ToJsonString());RefreshList(id);}
    private void Delete(){if(!Resolve()||selectedId is null)return;if(MonsterDatabaseReader.Visuals.Contains(selectedId)){MessageBox.Show(this,"Original enemy IDs are protected because the current campaign references them. MM14 will add full Where Used checks.");return;}
        var root=document.Model;var rows=root["monsters"]!.AsArray();if(rows.Count==1)throw new InvalidOperationException("At least one monster is required.");var item=rows.First(v=>v!["id"]!.ToString()==selectedId)!;rows.Remove(item);document.Apply(root.ToJsonString());selectedId=null;Refresh();}
    private void WhereUsed()
    {
        if(selectedId is null)return;
        if(encounterGroupsPath is null||!File.Exists(encounterGroupsPath)){MessageBox.Show(this,"No authored encounter groups are declared for this project.","Where used");return;}
        var data=EncounterDatabaseReader.ReadGroups(File.ReadAllText(encounterGroupsPath));
        var uses=data["groups"]!.AsArray().Where(g=>g!["members"]!.AsArray().Any(m=>m!["kindId"]!.ToString()==selectedId)).Select(g=>$"{g!["name"]} [{g["id"]}]").ToArray();
        MessageBox.Show(this,uses.Length==0?"No encounter groups currently use this monster.":string.Join(Environment.NewLine,uses),"Where used — "+selectedId);
    }
    private void Save(){if(!Resolve())return;document.Save();ShowStatus();}
    private void OnClosing(object? sender,FormClosingEventArgs e){if(!Resolve()){e.Cancel=true;return;}if(!document.IsDirty)return;var response=MessageBox.Show(this,"Save monster changes?","Unsaved monsters",MessageBoxButtons.YesNoCancel);if(response==DialogResult.Cancel){e.Cancel=true;return;}if(response==DialogResult.Yes)try{Save();}catch(Exception ex){MessageBox.Show(this,ex.Message);e.Cancel=true;}}
    protected override bool ProcessCmdKey(ref Message msg,Keys key){if(key==(Keys.Control|Keys.S)){Safe(Save);return true;}return base.ProcessCmdKey(ref msg,key);}
}
