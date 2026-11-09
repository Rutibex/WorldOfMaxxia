using System.Drawing.Drawing2D;
using System.Text.Json;
using System.Text.Json.Nodes;
using MaxxiaMaker.Documents;
using MaxxiaMaker.ProjectModel;
namespace MaxxiaMaker;

/// <summary>MM14: reusable encounter groups, map placements and a read-only tile map marker preview.</summary>
public sealed class EncountersDatabaseForm : Form
{
    private readonly EncounterDatabaseDocument groupsDoc,placementsDoc;
    private readonly IReadOnlyList<MapIndexEntry> maps;
    private readonly string[] monsterIds;
    private readonly DataGridView groupsGrid=Grid(),membersGrid=Grid(),placementsGrid=Grid();
    private readonly ComboBox previewMap=new(){DropDownStyle=ComboBoxStyle.DropDownList,Width=260};
    private readonly Panel mapCanvas=new(){Dock=DockStyle.Fill,BackColor=Color.FromArgb(28,29,32),AutoScroll=true};
    private readonly Label status=new(){AutoSize=true};
    private readonly Dictionary<string,JsonArray> membersByGroup=new(StringComparer.Ordinal);
    private string? selectedGroup;private bool refreshing,draft;
    private readonly Stack<(bool Groups,bool Placements)> undoOperations=new(),redoOperations=new();
    private static DataGridView Grid()=>new(){Dock=DockStyle.Fill,AllowUserToAddRows=false,AllowUserToDeleteRows=false,AutoSizeColumnsMode=DataGridViewAutoSizeColumnsMode.Fill,RowHeadersVisible=false,SelectionMode=DataGridViewSelectionMode.FullRowSelect,MultiSelect=false};
    private static string NewId(string prefix)=>prefix+"_"+Guid.NewGuid().ToString("N");
    private static DataGridViewTextBoxColumn TextColumn(string name,string title,bool readOnly=false)=>new(){Name=name,HeaderText=title,ReadOnly=readOnly};
    private static DataGridViewComboBoxColumn ChoiceColumn(string name,string title,IEnumerable<string> values)=>new(){Name=name,HeaderText=title,DataSource=values.ToArray()};
    private void Button(Control parent,string name,Action action){var b=new Button{Text=name,AutoSize=true};b.Click+=(_,_)=>Guard(action);parent.Controls.Add(b);}
    private void Guard(Action action){try{action();}catch(Exception ex){MessageBox.Show(this,ex.Message,"Encounter database",MessageBoxButtons.OK,MessageBoxIcon.Warning);}}
    private void Dirty(){if(refreshing)return;draft=true;Status();}
    private void Status()=>status.Text=groupsDoc.HasExternalChange||placementsDoc.HasExternalChange?"External file change detected — save will be blocked":draft?"Unapplied changes":groupsDoc.IsDirty||placementsDoc.IsDirty?"Unsaved encounter files":"Saved";
    private static string Resolve(string folder,string relative)
    {
        var full=Path.GetFullPath(Path.Combine(folder,relative.Replace('/',Path.DirectorySeparatorChar)));
        if(!full.StartsWith(folder+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new ManifestException("E_PATH","$.content","Encounter files must remain inside the project.");
        return full;
    }
    public EncountersDatabaseForm(string manifestPath,ProjectManifest project)
    {
        var content=project.Content;
        if(content.EncounterGroups is not { Length: >0 } groups||content.EncounterPlacements is not { Length: >0 } placements)
            throw new ManifestException("E_ENCOUNTER_PAIR","$.content","Set both encounterGroups and encounterPlacements in the manifest.");
        var root=Path.GetDirectoryName(Path.GetFullPath(manifestPath))!;
        groupsDoc=new EncounterDatabaseDocument(Resolve(root,groups),EncounterDatabaseReader.ReadGroups);
        placementsDoc=new EncounterDatabaseDocument(Resolve(root,placements),EncounterDatabaseReader.ReadPlacements);
        maps=MapIndexReader.Read(manifestPath,project);
        var monsterPath=content.Monsters??throw new ManifestException("E_MONSTER_DB","$.content.monsters","Declare the monsters database before editing encounters.");
        var monsters=MonsterDatabaseReader.Read(File.ReadAllText(Resolve(root,monsterPath)));
        monsterIds=monsters["monsters"]!.AsArray().Select(m=>m!["id"]!.ToString()).ToArray();
        Text="Maxxia Maker — Encounter groups & placements";ClientSize=new Size(1180,780);MinimumSize=new Size(850,580);StartPosition=FormStartPosition.CenterParent;AutoScaleMode=AutoScaleMode.Dpi;
        var tabs=new TabControl{Dock=DockStyle.Fill};
        var groupTab=new TabPage("Reusable encounter groups");
        var groupSplit=new SplitContainer{Dock=DockStyle.Fill,Orientation=Orientation.Horizontal,SplitterDistance=275,Panel1MinSize=170,Panel2MinSize=145};
        groupsGrid.Columns.Add(TextColumn("id","Stable group ID",true));groupsGrid.Columns.Add(TextColumn("name","Display name"));
        groupsGrid.Columns.Add(new DataGridViewCheckBoxColumn{Name="boss",HeaderText="Boss"});groupsGrid.Columns.Add(TextColumn("musicTag","Music tag (optional)"));
        var groupTools=new FlowLayoutPanel{Dock=DockStyle.Bottom,Height=45};
        Button(groupTools,"New group",NewGroup);Button(groupTools,"Duplicate",DuplicateGroup);Button(groupTools,"Delete",DeleteGroup);Button(groupTools,"Where used",WhereUsed);
        groupSplit.Panel1.Controls.Add(groupsGrid);groupSplit.Panel1.Controls.Add(groupTools);
        membersGrid.Columns.Add(ChoiceColumn("kindId","Monster",monsterIds));membersGrid.Columns.Add(TextColumn("dx","Relative X"));membersGrid.Columns.Add(TextColumn("dy","Relative Y"));
        var memberTools=new FlowLayoutPanel{Dock=DockStyle.Bottom,Height=45};
        Button(memberTools,"Add monster",AddMember);Button(memberTools,"Remove selected",RemoveMember);
        groupSplit.Panel2.Controls.Add(membersGrid);groupSplit.Panel2.Controls.Add(memberTools);
        groupTab.Controls.Add(groupSplit);tabs.TabPages.Add(groupTab);

        var placementTab=new TabPage("Map placements");
        placementsGrid.Columns.Add(TextColumn("id","Stable placement ID",true));
        placementsGrid.Columns.Add(ChoiceColumn("mapId","Map",maps.Select(m=>m.Id)));
        placementsGrid.Columns.Add(ChoiceColumn("groupId","Group",groupsDoc.Model["groups"]!.AsArray().Select(g=>g!["id"]!.ToString())));
        placementsGrid.Columns.Add(TextColumn("x","X"));placementsGrid.Columns.Add(TextColumn("y","Y"));
        placementsGrid.Columns.Add(TextColumn("triggerRange","Range"));
        placementsGrid.Columns.Add(ChoiceColumn("respawn","Respawn",["never","on-reentry"]));
        placementsGrid.Columns.Add(TextColumn("enemyIds","Persistent enemy IDs (comma-separated)"));
        var placementTools=new FlowLayoutPanel{Dock=DockStyle.Bottom,Height=45};
        Button(placementTools,"Add placement",NewPlacement);Button(placementTools,"Duplicate",DuplicatePlacement);Button(placementTools,"Delete",DeletePlacement);
        placementTab.Controls.Add(placementsGrid);placementTab.Controls.Add(placementTools);tabs.TabPages.Add(placementTab);

        var mapTab=new TabPage("Read-only map markers");
        var mapHeader=new FlowLayoutPanel{Dock=DockStyle.Top,Height=45};
        mapHeader.Controls.Add(new Label{Text="View map:",AutoSize=true,Padding=new Padding(8,10,2,0)});
        mapHeader.Controls.Add(previewMap);
        mapHeader.Controls.Add(new Label{Text="Red markers are encounter placements. Map painting begins in MM17.",AutoSize=true,Padding=new Padding(10,10,0,0)});
        foreach(var map in maps)previewMap.Items.Add(map.Id);
        mapCanvas.Paint+=(_,e)=>DrawMap(e.Graphics);
        mapTab.Controls.Add(mapCanvas);mapTab.Controls.Add(mapHeader);tabs.TabPages.Add(mapTab);
        var footer=new FlowLayoutPanel{Dock=DockStyle.Bottom,Height=48,Padding=new Padding(7)};
        Button(footer,"Apply",Apply);Button(footer,"Undo both",Undo);Button(footer,"Redo both",Redo);Button(footer,"Save files",Save);Button(footer,"Close",Close);footer.Controls.Add(status);
        Controls.Add(tabs);Controls.Add(footer);
        groupsGrid.SelectionChanged+=(_,_)=>GroupSelected();
        foreach(var grid in new[]{groupsGrid,membersGrid,placementsGrid})
        {grid.CellValueChanged+=(_,_)=>Dirty();grid.RowsAdded+=(_,_)=>Dirty();grid.RowsRemoved+=(_,_)=>Dirty();grid.CurrentCellDirtyStateChanged+=(_,_)=>{if(grid.IsCurrentCellDirty)grid.CommitEdit(DataGridViewDataErrorContexts.Commit);};grid.DataError+=(_,e)=>{e.ThrowException=false;};}
        previewMap.SelectedIndexChanged+=(_,_)=>mapCanvas.Invalidate();
        FormClosing+=(_,e)=>{if(draft||groupsDoc.IsDirty||placementsDoc.IsDirty){var result=MessageBox.Show(this,"Discard unsaved encounter edits?","Unsaved encounter changes",MessageBoxButtons.YesNo,MessageBoxIcon.Warning);if(result!=DialogResult.Yes)e.Cancel=true;}};
        Reload();
    }
    private static JsonArray MembersFromGrid(DataGridView grid)
    {
        var a=new JsonArray();foreach(DataGridViewRow row in grid.Rows)
        {
            var kind=row.Cells["kindId"].Value?.ToString()??"";
            a.Add(new JsonObject{["kindId"]=kind,["dx"]=int.Parse(row.Cells["dx"].Value?.ToString()??"0"),["dy"]=int.Parse(row.Cells["dy"].Value?.ToString()??"0")});
        }return a;
    }
    private void StashMembers(){if(selectedGroup is not null&&membersByGroup.ContainsKey(selectedGroup))membersByGroup[selectedGroup]=MembersFromGrid(membersGrid);}
    private void GroupSelected()
    {
        if(refreshing)return;
        // When grid selection moves, preserve the member edits for the previous group.
        membersGrid.EndEdit();StashMembers();selectedGroup=groupsGrid.CurrentRow?.Cells["id"].Value?.ToString();
        refreshing=true;membersGrid.Rows.Clear();
        if(selectedGroup is not null&&membersByGroup.TryGetValue(selectedGroup,out var arr))foreach(var member in arr)membersGrid.Rows.Add(member!["kindId"]!.ToString(),member["dx"]!.ToString(),member["dy"]!.ToString());
        refreshing=false;
    }
    private void Reload()
    {
        refreshing=true;selectedGroup=null;membersByGroup.Clear();groupsGrid.Rows.Clear();membersGrid.Rows.Clear();placementsGrid.Rows.Clear();
        foreach(var g in groupsDoc.Model["groups"]!.AsArray())
        {
            var id=g!["id"]!.ToString();membersByGroup[id]=g["members"]!.AsArray().DeepClone().AsArray();
            groupsGrid.Rows.Add(id,g["name"]!.ToString(),g["boss"]!.GetValue<bool>(),g["musicTag"]?.ToString()??"");
        }
        foreach(var p in placementsDoc.Model["placements"]!.AsArray())placementsGrid.Rows.Add(p!["id"]!.ToString(),p["mapId"]!.ToString(),p["groupId"]!.ToString(),p["x"]!.ToString(),p["y"]!.ToString(),p["triggerRange"]!.ToString(),p["respawn"]!.ToString(),string.Join(",",p["enemyIds"]!.AsArray().Select(x=>x!.ToString())));
        UpdateGroupChoices();previewMap.SelectedIndex=previewMap.Items.Count>0?0:-1;
        refreshing=false;GroupSelected();draft=false;Status();mapCanvas.Invalidate();
    }
    private void UpdateGroupChoices()
    {
        var groupColumn=(DataGridViewComboBoxColumn)placementsGrid.Columns["groupId"];
        groupColumn.DataSource=groupsGrid.Rows.Cast<DataGridViewRow>().Select(row=>row.Cells["id"].Value?.ToString()??"").Where(v=>v.Length>0).ToArray();
    }
    private void NewGroup()
    {
        StashMembers();var id=NewId("group");membersByGroup[id]=new JsonArray(new JsonObject{["kindId"]=monsterIds[0],["dx"]=0,["dy"]=0});
        var i=groupsGrid.Rows.Add(id,"New encounter",false,"");UpdateGroupChoices();groupsGrid.CurrentCell=groupsGrid.Rows[i].Cells["name"];GroupSelected();Dirty();
    }
    private void DuplicateGroup()
    {
        StashMembers();var row=groupsGrid.CurrentRow;if(row is null)return;var from=row.Cells["id"].Value!.ToString()!;
        var id=NewId("group");membersByGroup[id]=membersByGroup[from].DeepClone().AsArray();
        var i=groupsGrid.Rows.Add(id,(row.Cells["name"].Value?.ToString()??"Encounter")+" copy",row.Cells["boss"].Value??false,row.Cells["musicTag"].Value??"");
        UpdateGroupChoices();groupsGrid.CurrentCell=groupsGrid.Rows[i].Cells["name"];GroupSelected();Dirty();
    }
    private void DeleteGroup()
    {
        var row=groupsGrid.CurrentRow;if(row is null)return;var id=row.Cells["id"].Value?.ToString();
        if(placementsGrid.Rows.Cast<DataGridViewRow>().Any(r=>r.Cells["groupId"].Value?.ToString()==id))throw new InvalidOperationException("This group is placed on a map. Delete or remap its placements first.");
        selectedGroup=null;membersByGroup.Remove(id!);groupsGrid.Rows.Remove(row);UpdateGroupChoices();GroupSelected();Dirty();
    }
    private void WhereUsed()
    {
        var id=groupsGrid.CurrentRow?.Cells["id"].Value?.ToString();if(id is null)return;
        var list=placementsGrid.Rows.Cast<DataGridViewRow>().Where(r=>r.Cells["groupId"].Value?.ToString()==id).Select(r=>$"{r.Cells["id"].Value} at {r.Cells["mapId"].Value} ({r.Cells["x"].Value},{r.Cells["y"].Value})").ToArray();
        MessageBox.Show(this,list.Length==0?"No placed instances.":string.Join(Environment.NewLine,list),"Where used: "+id);
    }
    private void AddMember(){if(selectedGroup is null)return;if(membersGrid.Rows.Count>=3)throw new InvalidOperationException("Current combat targeting supports up to three monsters per encounter group.");membersGrid.Rows.Add(monsterIds[0],0,0);Dirty();}
    private void RemoveMember(){if(membersGrid.CurrentRow is { } row){membersGrid.Rows.Remove(row);Dirty();}}
    private string CurrentGroup(){return groupsGrid.CurrentRow?.Cells["id"].Value?.ToString()??throw new InvalidOperationException("Create an encounter group first.");}
    private int MemberCount(string id){StashMembers();return membersByGroup[id].Count;}
    private static string EnemyIds(int count)=>string.Join(",",Enumerable.Range(0,count).Select(_=>NewId("enemy")));
    private void NewPlacement()
    {
        var id=CurrentGroup();var map=previewMap.Items.Count>0?previewMap.Items[0]!.ToString():throw new InvalidOperationException("No maps in the project.");
        var mapInfo=maps.First(m=>m.Id==map);using var json=JsonDocument.Parse(File.ReadAllText(mapInfo.FilePath));var rows=json.RootElement.GetProperty("rows").EnumerateArray().Select(v=>v.GetString()!).ToArray();
        var y=Array.FindIndex(rows,row=>row.Contains('.'));var x=y<0?0:rows[y].IndexOf('.');
        placementsGrid.Rows.Add(NewId("enc"),map,id,x,y,1,"never",EnemyIds(MemberCount(id)));Dirty();
    }
    private void DuplicatePlacement()
    {
        var r=placementsGrid.CurrentRow;if(r is null)return;
        var group=r.Cells["groupId"].Value?.ToString()??CurrentGroup();
        placementsGrid.Rows.Add(NewId("enc"),r.Cells["mapId"].Value,group,r.Cells["x"].Value,r.Cells["y"].Value,r.Cells["triggerRange"].Value,r.Cells["respawn"].Value,EnemyIds(MemberCount(group)));Dirty();
    }
    private void DeletePlacement(){if(placementsGrid.CurrentRow is { } row){placementsGrid.Rows.Remove(row);Dirty();}}
    private JsonObject BuildGroups()
    {
        var result=new JsonArray();foreach(DataGridViewRow r in groupsGrid.Rows)
        {
            var id=r.Cells["id"].Value?.ToString()??"";if(!membersByGroup.TryGetValue(id,out var members))throw new InvalidOperationException("A group has no members.");
            var music=r.Cells["musicTag"].Value?.ToString()?.Trim()??"";
            result.Add(new JsonObject{["id"]=id,["name"]=r.Cells["name"].Value?.ToString()??"",["boss"]=r.Cells["boss"].Value is bool b&&b,["musicTag"]=music.Length==0?null:JsonValue.Create(music),["members"]=members.DeepClone()});
        }
        return new JsonObject{["format"]="maxxia-encounter-groups",["version"]=1,["groups"]=result};
    }
    private JsonObject BuildPlacements()
    {
        var array=new JsonArray();foreach(DataGridViewRow r in placementsGrid.Rows)
        {
            var ids=r.Cells["enemyIds"].Value?.ToString()?.Split(',',StringSplitOptions.TrimEntries|StringSplitOptions.RemoveEmptyEntries)??[];
            array.Add(new JsonObject{["id"]=r.Cells["id"].Value?.ToString()??"",["mapId"]=r.Cells["mapId"].Value?.ToString()??"",["groupId"]=r.Cells["groupId"].Value?.ToString()??"",["x"]=int.Parse(r.Cells["x"].Value?.ToString()??""),["y"]=int.Parse(r.Cells["y"].Value?.ToString()??""),["triggerRange"]=int.Parse(r.Cells["triggerRange"].Value?.ToString()??""),["respawn"]=r.Cells["respawn"].Value?.ToString()??"never",["enemyIds"]=new JsonArray(ids.Select(id=>(JsonNode?)JsonValue.Create(id)).ToArray())});
        }
        return new JsonObject{["format"]="maxxia-encounter-placements",["version"]=1,["placements"]=array};
    }
    private void Apply()
    {
        groupsGrid.EndEdit();membersGrid.EndEdit();placementsGrid.EndEdit();StashMembers();
        var groups=BuildGroups();var placements=BuildPlacements();
        EncounterDatabaseReader.ReadGroups(groups.ToJsonString());EncounterDatabaseReader.ReadPlacements(placements.ToJsonString());
        EncounterDatabaseReader.ValidateLinks(groups,placements,monsterIds,maps);
        var gChanged=groupsDoc.Apply(groups.ToJsonString());var pChanged=placementsDoc.Apply(placements.ToJsonString());
        if(gChanged||pChanged){undoOperations.Push((gChanged,pChanged));redoOperations.Clear();}
        Reload();
    }
    private void Undo(){if(draft)throw new InvalidOperationException("Apply or discard draft edits before undo.");if(!undoOperations.TryPop(out var op))return;if(op.Groups)groupsDoc.Undo();if(op.Placements)placementsDoc.Undo();redoOperations.Push(op);Reload();}
    private void Redo(){if(draft)throw new InvalidOperationException("Apply or discard draft edits before redo.");if(!redoOperations.TryPop(out var op))return;if(op.Groups)groupsDoc.Redo();if(op.Placements)placementsDoc.Redo();undoOperations.Push(op);Reload();}
    private void Save()
    {
        if(draft)Apply();
        // Each document is guarded and atomic. A failure writing the second leaves it dirty and recoverable.
        groupsDoc.Save();placementsDoc.Save();Status();
    }
    private void DrawMap(Graphics g)
    {
        if(previewMap.SelectedItem is not string id)return;
        var map=maps.FirstOrDefault(m=>m.Id==id);if(map is null)return;
        try{
            using var json=JsonDocument.Parse(File.ReadAllText(map.FilePath));
            var rows=json.RootElement.GetProperty("rows").EnumerateArray().Select(v=>v.GetString()!).ToArray();
            var cell=26;var offset=12;g.SmoothingMode=SmoothingMode.AntiAlias;
            using var wall=new SolidBrush(Color.FromArgb(75,77,86));using var floor=new SolidBrush(Color.FromArgb(188,190,177));
            using var door=new SolidBrush(Color.FromArgb(151,104,61));using var marker=new SolidBrush(Color.FromArgb(195,44,48));
            for(var y=0;y<rows.Length;y++)for(var x=0;x<rows[y].Length;x++){
                var c=rows[y][x];g.FillRectangle(c=='#'?wall:c=='D'?door:floor,offset+x*cell,offset+y*cell,cell-1,cell-1);
            }
            foreach(DataGridViewRow r in placementsGrid.Rows)
            {
                if(r.Cells["mapId"].Value?.ToString()!=id)continue;
                if(!int.TryParse(r.Cells["x"].Value?.ToString(),out var x)||!int.TryParse(r.Cells["y"].Value?.ToString(),out var y))continue;
                g.FillEllipse(marker,offset+x*cell+5,offset+y*cell+5,cell-10,cell-10);
            }
        }catch(Exception ex){g.DrawString("Map preview unavailable: "+ex.Message,Font,Brushes.White,12,12);}
    }
}
