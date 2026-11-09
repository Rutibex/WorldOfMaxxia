using System.Text.Json;
using System.Text.Json.Nodes;
using MaxxiaMaker.Documents;
using MaxxiaMaker.ProjectModel;
namespace MaxxiaMaker;

/// <summary>MM15: edit project loot tables, encounter assignments, and persistent ground pickups.</summary>
public sealed class LootDatabaseForm:Form
{
    private readonly EncounterDatabaseDocument tablesDoc,pickupsDoc;
    private readonly IReadOnlyList<MapIndexEntry> maps;
    private readonly string[] itemIds,encounterIds;
    private readonly DataGridView tables=Grid(),entries=Grid(),assignments=Grid(),pickups=Grid(),pickupItems=Grid();
    private readonly Dictionary<string,JsonArray> tableEntries=new(StringComparer.Ordinal),placedItems=new(StringComparer.Ordinal);
    private readonly Dictionary<string,JsonNode?> questMetadata=new(StringComparer.Ordinal);
    private readonly Stack<(bool Loot,bool Pickups)> undo=new(),redo=new();
    private readonly Label status=new(){AutoSize=true};
    private string? activeTable,activePickup;private bool refreshing,draft;
    private static DataGridView Grid()=>new(){Dock=DockStyle.Fill,AllowUserToAddRows=false,AllowUserToDeleteRows=false,AutoSizeColumnsMode=DataGridViewAutoSizeColumnsMode.Fill,RowHeadersVisible=false,SelectionMode=DataGridViewSelectionMode.FullRowSelect,MultiSelect=false};
    private static DataGridViewTextBoxColumn ReadText(string key,string label,bool locked=false)=>new(){Name=key,HeaderText=label,ReadOnly=locked};
    private static DataGridViewComboBoxColumn Choice(string key,string label,IEnumerable<string> values)=>new(){Name=key,HeaderText=label,DataSource=values.ToArray()};
    private static string NewId(string prefix)=>prefix+"_"+Guid.NewGuid().ToString("N");
    private static string Value(DataGridViewRow row,string col)=>row.Cells[col].Value?.ToString()??"";
    private static int Number(DataGridViewRow row,string col)=>int.Parse(Value(row,col));
    private static string Resolve(string folder,string relative)
    {
        var full=Path.GetFullPath(Path.Combine(folder,relative.Replace('/',Path.DirectorySeparatorChar)));
        if(!full.StartsWith(folder+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new ManifestException("E_PATH","$.content","Loot files must remain in this project.");
        return full;
    }
    private void Guard(Action work){try{work();}catch(Exception ex){MessageBox.Show(this,ex.Message,"Loot database",MessageBoxButtons.OK,MessageBoxIcon.Warning);}}
    private void AddButton(Control parent,string caption,Action action){var b=new Button{Text=caption,AutoSize=true};b.Click+=(_,_)=>Guard(action);parent.Controls.Add(b);}
    private static FlowLayoutPanel Buttons()=>new(){Dock=DockStyle.Bottom,Height=46,Padding=new Padding(5)};
    private static SplitContainer Split()=>new(){Dock=DockStyle.Fill,Orientation=Orientation.Horizontal,SplitterDistance=300,Panel1MinSize=130,Panel2MinSize=125};
    public LootDatabaseForm(string projectPath,ProjectManifest manifest)
    {
        var content=manifest.Content;
        if(content.LootTables is not {Length:>0} path||content.GroundPickups is not {Length:>0} pickupPath)
            throw new ManifestException("E_LOOT","$.content","Set lootTables and groundPickups in the project manifest first.");
        var root=Path.GetDirectoryName(Path.GetFullPath(projectPath))!;
        tablesDoc=new EncounterDatabaseDocument(Resolve(root,path),LootDatabaseReader.ReadTables);
        pickupsDoc=new EncounterDatabaseDocument(Resolve(root,pickupPath),LootDatabaseReader.ReadPickups);
        maps=MapIndexReader.Read(projectPath,manifest);
        if(content.Items is not {Length:>0} itemsPath||content.EncounterPlacements is not {Length:>0} encountersPath)
            throw new ManifestException("E_LOOT","$.content","Items and encounter placements must be configured before editing loot.");
        itemIds=ItemDatabaseReader.Read(File.ReadAllText(Resolve(root,itemsPath)))["items"]!.AsArray().Select(i=>i!["id"]!.ToString()).ToArray();
        encounterIds=EncounterDatabaseReader.ReadPlacements(File.ReadAllText(Resolve(root,encountersPath)))["placements"]!.AsArray().Select(i=>i!["id"]!.ToString()).ToArray();
        Text="Maxxia Maker — Loot tables, corpses and ground pickups";ClientSize=new Size(1200,800);MinimumSize=new Size(850,580);StartPosition=FormStartPosition.CenterParent;AutoScaleMode=AutoScaleMode.Dpi;
        var tabs=new TabControl{Dock=DockStyle.Fill};
        var tableTab=new TabPage("Reusable loot tables");var tableSplit=Split();
        tables.Columns.Add(ReadText("id","Stable table ID",true));tables.Columns.Add(ReadText("name","Display name"));
        var tableTools=Buttons();AddButton(tableTools,"New table",NewTable);AddButton(tableTools,"Duplicate",DuplicateTable);AddButton(tableTools,"Delete",DeleteTable);AddButton(tableTools,"Where used",WhereUsed);
        tableSplit.Panel1.Controls.Add(tables);tableSplit.Panel1.Controls.Add(tableTools);
        entries.Columns.Add(Choice("itemId","Item",itemIds));entries.Columns.Add(ReadText("chance","Chance %"));entries.Columns.Add(ReadText("min","Min quantity"));entries.Columns.Add(ReadText("max","Max quantity"));entries.Columns.Add(ReadText("memberIndex","Monster slot (0–2)"));
        var entryTools=Buttons();AddButton(entryTools,"Add drop",()=>{if(activeTable is null)return;entries.Rows.Add(itemIds.First(),100,1,1,0);Dirty();});AddButton(entryTools,"Remove drop",()=>{if(entries.CurrentRow is { } r)entries.Rows.Remove(r);Dirty();});
        tableSplit.Panel2.Controls.Add(entries);tableSplit.Panel2.Controls.Add(entryTools);tableTab.Controls.Add(tableSplit);tabs.TabPages.Add(tableTab);
        var assignmentTab=new TabPage("Encounter loot assignments");
        assignments.Columns.Add(Choice("encounterId","Encounter placement",encounterIds));assignments.Columns.Add(Choice("tableId","Loot table",tablesDoc.Model["tables"]!.AsArray().Select(t=>t!["id"]!.ToString())));
        var assignmentTools=Buttons();AddButton(assignmentTools,"Assign loot",()=>{assignments.Rows.Add(encounterIds.First(),tables.Rows.Count>0?Value(tables.Rows[0],"id"):"");Dirty();});AddButton(assignmentTools,"Remove assignment",()=>{if(assignments.CurrentRow is { } r)assignments.Rows.Remove(r);Dirty();});
        assignmentTab.Controls.Add(assignments);assignmentTab.Controls.Add(assignmentTools);tabs.TabPages.Add(assignmentTab);
        var pickupTab=new TabPage("Placed ground pickups");var pickupSplit=Split();
        pickups.Columns.Add(ReadText("id","Stable pickup ID",true));pickups.Columns.Add(Choice("mapId","Map",maps.Select(m=>m.Id)));pickups.Columns.Add(ReadText("x","X"));pickups.Columns.Add(ReadText("y","Y"));pickups.Columns.Add(ReadText("name","Pile name"));pickups.Columns.Add(ReadText("gold","Gold"));pickups.Columns.Add(ReadText("questItemId","Quest item ID (optional)"));
        var pickupTools=Buttons();AddButton(pickupTools,"New pickup",NewPickup);AddButton(pickupTools,"Duplicate",DuplicatePickup);AddButton(pickupTools,"Delete",DeletePickup);
        pickupSplit.Panel1.Controls.Add(pickups);pickupSplit.Panel1.Controls.Add(pickupTools);
        pickupItems.Columns.Add(Choice("itemId","Item",itemIds));pickupItems.Columns.Add(ReadText("count","Quantity"));
        var pickupItemTools=Buttons();AddButton(pickupItemTools,"Add item",()=>{if(activePickup is null)return;pickupItems.Rows.Add(itemIds.First(),1);Dirty();});AddButton(pickupItemTools,"Remove item",()=>{if(pickupItems.CurrentRow is { } row)pickupItems.Rows.Remove(row);Dirty();});
        pickupSplit.Panel2.Controls.Add(pickupItems);pickupSplit.Panel2.Controls.Add(pickupItemTools);pickupTab.Controls.Add(pickupSplit);tabs.TabPages.Add(pickupTab);
        var footer=Buttons();AddButton(footer,"Apply",Apply);AddButton(footer,"Undo",Undo);AddButton(footer,"Redo",Redo);AddButton(footer,"Save files",Save);AddButton(footer,"Close",Close);footer.Controls.Add(status);
        Controls.Add(tabs);Controls.Add(footer);
        tables.SelectionChanged+=(_,_)=>SelectTable();pickups.SelectionChanged+=(_,_)=>SelectPickup();
        foreach(var grid in new[]{tables,entries,assignments,pickups,pickupItems})
        {
            grid.CellValueChanged+=(_,_)=>Dirty();grid.RowsAdded+=(_,_)=>Dirty();grid.RowsRemoved+=(_,_)=>Dirty();
            grid.CurrentCellDirtyStateChanged+=(_,_)=>{if(grid.IsCurrentCellDirty)grid.CommitEdit(DataGridViewDataErrorContexts.Commit);};
            grid.DataError+=(_,e)=>{e.ThrowException=false;};
        }
        FormClosing+=(_,e)=>{if(draft||tablesDoc.IsDirty||pickupsDoc.IsDirty)
        {if(MessageBox.Show(this,"Discard unsaved loot edits?","Unsaved changes",MessageBoxButtons.YesNo,MessageBoxIcon.Warning)!=DialogResult.Yes)e.Cancel=true;}};
        Reload();
    }
    private void Dirty(){if(!refreshing){draft=true;Status();}}
    private void Status()=>status.Text=tablesDoc.HasExternalChange||pickupsDoc.HasExternalChange?"External file changed — saving blocked":draft?"Unapplied changes":tablesDoc.IsDirty||pickupsDoc.IsDirty?"Changes not saved":"Saved";
    private static JsonArray Rows(DataGridView grid,Func<DataGridViewRow,JsonNode> build)
    {var array=new JsonArray();foreach(DataGridViewRow r in grid.Rows)array.Add(build(r));return array;}
    private void StashTable(){if(activeTable is not null)tableEntries[activeTable]=Rows(entries,r=>new JsonObject{["itemId"]=Value(r,"itemId"),["chance"]=Number(r,"chance"),["min"]=Number(r,"min"),["max"]=Number(r,"max"),["memberIndex"]=Number(r,"memberIndex")});}
    private void StashPickup(){if(activePickup is not null)placedItems[activePickup]=Rows(pickupItems,r=>new JsonObject{["itemId"]=Value(r,"itemId"),["count"]=Number(r,"count")});}
    private void SelectTable()
    {
        if(refreshing)return;
        entries.EndEdit();StashTable();activeTable=tables.CurrentRow is { } row?Value(row,"id"):null;
        refreshing=true;entries.Rows.Clear();if(activeTable is not null&&tableEntries.TryGetValue(activeTable,out var array))foreach(var item in array)
            entries.Rows.Add(item!["itemId"]!.ToString(),item["chance"]!.ToString(),item["min"]!.ToString(),item["max"]!.ToString(),item["memberIndex"]!.ToString());
        refreshing=false;
    }
    private void SelectPickup()
    {
        if(refreshing)return;
        pickupItems.EndEdit();StashPickup();activePickup=pickups.CurrentRow is { } row?Value(row,"id"):null;
        refreshing=true;pickupItems.Rows.Clear();if(activePickup is not null&&placedItems.TryGetValue(activePickup,out var array))foreach(var item in array)pickupItems.Rows.Add(item!["itemId"]!.ToString(),item["count"]!.ToString());
        refreshing=false;
    }
    private void Reload()
    {
        refreshing=true;activeTable=null;activePickup=null;tableEntries.Clear();placedItems.Clear();questMetadata.Clear();
        tables.Rows.Clear();entries.Rows.Clear();assignments.Rows.Clear();pickups.Rows.Clear();pickupItems.Rows.Clear();
        foreach(var t in tablesDoc.Model["tables"]!.AsArray())
        {var id=t!["id"]!.ToString();tableEntries[id]=t["entries"]!.AsArray().DeepClone().AsArray();tables.Rows.Add(id,t["name"]!.ToString());}
        foreach(var a in tablesDoc.Model["assignments"]!.AsArray())assignments.Rows.Add(a!["encounterId"]!.ToString(),a["tableId"]!.ToString());
        foreach(var p in pickupsDoc.Model["pickups"]!.AsArray())
        {var id=p!["id"]!.ToString();placedItems[id]=p["items"]!.AsArray().DeepClone().AsArray();questMetadata[id]=p["legacyQuest"]?.DeepClone();pickups.Rows.Add(id,p["mapId"]!.ToString(),p["x"]!.ToString(),p["y"]!.ToString(),p["name"]!.ToString(),p["gold"]!.ToString(),p["questItemId"]?.ToString()??"");}
        UpdateTableChoices();refreshing=false;SelectTable();SelectPickup();draft=false;Status();
    }
    private void UpdateTableChoices(){((DataGridViewComboBoxColumn)assignments.Columns["tableId"]).DataSource=tables.Rows.Cast<DataGridViewRow>().Select(r=>Value(r,"id")).Where(x=>x.Length>0).ToArray();}
    private void NewTable(){StashTable();var id=NewId("loot");tableEntries[id]=new JsonArray();var i=tables.Rows.Add(id,"New loot table");UpdateTableChoices();tables.CurrentCell=tables.Rows[i].Cells["name"];SelectTable();Dirty();}
    private void DuplicateTable(){StashTable();if(tables.CurrentRow is not { } r)return;var id=NewId("loot");tableEntries[id]=tableEntries[Value(r,"id")].DeepClone().AsArray();var i=tables.Rows.Add(id,Value(r,"name")+" copy");UpdateTableChoices();tables.CurrentCell=tables.Rows[i].Cells["name"];SelectTable();Dirty();}
    private void DeleteTable(){if(tables.CurrentRow is not { } row)return;var id=Value(row,"id");if(assignments.Rows.Cast<DataGridViewRow>().Any(r=>Value(r,"tableId")==id))throw new InvalidOperationException("Remove the encounter assignments before deleting this table.");activeTable=null;tableEntries.Remove(id);tables.Rows.Remove(row);UpdateTableChoices();SelectTable();Dirty();}
    private void WhereUsed(){if(tables.CurrentRow is not { } row)return;var id=Value(row,"id");var refs=assignments.Rows.Cast<DataGridViewRow>().Where(r=>Value(r,"tableId")==id).Select(r=>Value(r,"encounterId")).ToArray();MessageBox.Show(this,refs.Length==0?"No encounter assignments.":string.Join(Environment.NewLine,refs),"Where used: "+id);}
    private (string Map,int X,int Y) DefaultLocation()
    {
        var map=maps.First();using var json=JsonDocument.Parse(File.ReadAllText(map.FilePath));var rows=json.RootElement.GetProperty("rows").EnumerateArray().Select(v=>v.GetString()!).ToArray();
        var y=Array.FindIndex(rows,r=>r.Contains('.'));if(y<0)throw new InvalidOperationException("Map has no walkable tile.");return(map.Id,rows[y].IndexOf('.'),y);
    }
    private void NewPickup(){StashPickup();var id=NewId("pickup");var pos=DefaultLocation();placedItems[id]=new JsonArray();questMetadata[id]=null;var i=pickups.Rows.Add(id,pos.Map,pos.X,pos.Y,"Ground treasure",0,"");pickups.CurrentCell=pickups.Rows[i].Cells["name"];SelectPickup();Dirty();}
    private void DuplicatePickup(){StashPickup();if(pickups.CurrentRow is not { } r)return;var id=NewId("pickup");var old=Value(r,"id");placedItems[id]=placedItems[old].DeepClone().AsArray();questMetadata[id]=null;var i=pickups.Rows.Add(id,Value(r,"mapId"),Value(r,"x"),Value(r,"y"),Value(r,"name")+" copy",Value(r,"gold"),"");pickups.CurrentCell=pickups.Rows[i].Cells["name"];SelectPickup();Dirty();}
    private void DeletePickup(){if(pickups.CurrentRow is not { } row)return;var id=Value(row,"id");if(questMetadata.GetValueOrDefault(id) is not null)throw new InvalidOperationException("Original quest pickups are protected until the campaign conversion (MM32–MM34).");activePickup=null;placedItems.Remove(id);questMetadata.Remove(id);pickups.Rows.Remove(row);SelectPickup();Dirty();}
    private JsonObject BuildTables()
    {
        var t=Rows(tables,r=>new JsonObject{["id"]=Value(r,"id"),["name"]=Value(r,"name"),["entries"]=tableEntries[Value(r,"id")].DeepClone()});
        var a=Rows(assignments,r=>new JsonObject{["encounterId"]=Value(r,"encounterId"),["tableId"]=Value(r,"tableId")});
        return new JsonObject{["format"]="maxxia-loot-tables",["version"]=1,["tables"]=t,["assignments"]=a};
    }
    private JsonObject BuildPickups()
    {
        var arr=Rows(pickups,r=>
        {
            var id=Value(r,"id");var p=new JsonObject{["id"]=id,["mapId"]=Value(r,"mapId"),["x"]=Number(r,"x"),["y"]=Number(r,"y"),["name"]=Value(r,"name"),["gold"]=Number(r,"gold"),["items"]=placedItems[id].DeepClone()};
            if(questMetadata.GetValueOrDefault(id) is { } quest)p["legacyQuest"]=quest.DeepClone();
            var questId=Value(r,"questItemId").Trim();if(questId.Length>0)p["questItemId"]=questId;return p;
        });
        return new JsonObject{["format"]="maxxia-ground-pickups",["version"]=1,["pickups"]=arr};
    }
    private void Apply()
    {
        foreach(var grid in new[]{tables,entries,assignments,pickups,pickupItems})grid.EndEdit();StashTable();StashPickup();
        var tableModel=BuildTables();var pickupModel=BuildPickups();
        LootDatabaseReader.ReadTables(tableModel.ToJsonString());LootDatabaseReader.ReadPickups(pickupModel.ToJsonString());
        LootDatabaseReader.ValidateLinks(tableModel,pickupModel,itemIds,encounterIds,maps);
        var a=tablesDoc.Apply(tableModel.ToJsonString());var b=pickupsDoc.Apply(pickupModel.ToJsonString());
        if(a||b){undo.Push((a,b));redo.Clear();}Reload();
    }
    private void Undo(){if(draft)throw new InvalidOperationException("Apply or discard the draft before undo.");if(!undo.TryPop(out var step))return;if(step.Loot)tablesDoc.Undo();if(step.Pickups)pickupsDoc.Undo();redo.Push(step);Reload();}
    private void Redo(){if(draft)throw new InvalidOperationException("Apply or discard the draft before redo.");if(!redo.TryPop(out var step))return;if(step.Loot)tablesDoc.Redo();if(step.Pickups)pickupsDoc.Redo();undo.Push(step);Reload();}
    private void Save(){if(draft)Apply();tablesDoc.Save();pickupsDoc.Save();Status();}
}
