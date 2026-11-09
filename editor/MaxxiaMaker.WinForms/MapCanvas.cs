using System.Text.Json.Nodes;
using MaxxiaMaker.Documents;

namespace MaxxiaMaker;

/// <summary>Native grid view. Temporary strokes are separate from accepted document history.</summary>
public sealed class MapCanvas : Control
{
    [System.ComponentModel.DesignerSerializationVisibility(System.ComponentModel.DesignerSerializationVisibility.Hidden)]
    public MapDocument? Document { get; set; }
    [System.ComponentModel.DesignerSerializationVisibility(System.ComponentModel.DesignerSerializationVisibility.Hidden)]
    public string Tool { get; set; } = "Pencil";
    [System.ComponentModel.DesignerSerializationVisibility(System.ComponentModel.DesignerSerializationVisibility.Hidden)]
    public char Brush { get; set; } = '.';
    public string MaterialSurface {get;set;}="wall";
    public string MaterialBrush {get;set;}="material_wall_default";
    public event Action? Changed;
    public event Action<string,int,int>? MarkerClicked;
    public event Action<string>? Status;
    private JsonObject? draft;
    private Point origin=new(32,32), start, last, panStart;
    private int cell=26;
    private bool drawing, panning;
    private Rectangle selection;
    private string[]? clipboard;
    public MapCanvas() { DoubleBuffered=true;Dock=DockStyle.Fill;BackColor=Color.FromArgb(28,30,36);TabStop=true; }
    private Point Tile(Point p)=>new((int)Math.Floor((double)(p.X-origin.X)/cell),(int)Math.Floor((double)(p.Y-origin.Y)/cell));
    public void Zoom(int delta) { cell=Math.Clamp(cell+delta,10,64);Invalidate(); }
    public void ResetView() {origin=new(32,32);selection=Rectangle.Empty;Invalidate();}
    protected override void OnMouseWheel(MouseEventArgs e) {Zoom(e.Delta>0?4:-4);base.OnMouseWheel(e);}
    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);var map=draft??Document?.Model;if(map is null)return;
        var rows=map["geometry"]!["rows"]!.AsArray();
        using var grid=new Pen(Color.FromArgb(80,85,95));using var selected=new Pen(Color.Gold,2);
        var highlighted=(map["materials"]?[MaterialSurface]?["overrides"]?.AsArray()??new JsonArray())
            .Select(n=>(x:MapDocument.Number(n!,"x"),y:MapDocument.Number(n!,"y"))).ToHashSet();
        for(var y=0;y<rows.Count;y++)for(var x=0;x<rows[y]!.ToString().Length;x++)
        {
            var rect=new Rectangle(origin.X+x*cell,origin.Y+y*cell,cell,cell);
            e.Graphics.FillRectangle(rows[y]!.ToString()[x] switch {'#'=>Brushes.SlateGray,'D'=>Brushes.SaddleBrown,_=>Brushes.Beige},rect);e.Graphics.DrawRectangle(grid,rect);
            if(selection.Contains(x,y))e.Graphics.DrawRectangle(selected,rect);
            if(highlighted.Contains((x,y)))
            {var chip=new Rectangle(rect.Right-Math.Min(11,cell/2),rect.Top+2,Math.Min(8,cell/3),Math.Min(8,cell/3));e.Graphics.FillRectangle(Brushes.Gold,chip);}
        }
        foreach(var node in MapDocument.Positioned(map))
        {
            var x=MapDocument.Number(node,"x");var y=MapDocument.Number(node,"y");
            var id=node["id"]?.ToString()??"";
            var arrival=id.StartsWith("arrival_",StringComparison.Ordinal);
            var portal=map["objects"]!["portals"]!.AsArray().Any(p=>p!["id"]?.ToString()==id);
            var symbol=arrival?"A":portal?"T":"•";
            var ink=arrival?Brushes.DarkGreen:portal?Brushes.DarkBlue:Brushes.DarkRed;
            // Display both markers even when a return transfer shares its arrival square.
            e.Graphics.DrawString(symbol,Font,ink,origin.X+x*cell+(portal?cell/2:2),origin.Y+y*cell+1);
        }
        if(drawing&&Tool=="Rectangle") {var r=Area(start,last);e.Graphics.DrawRectangle(selected,origin.X+r.X*cell,origin.Y+r.Y*cell,r.Width*cell,r.Height*cell);}
        for(var x=0;x<MapDocument.Number(map,"width");x++)e.Graphics.DrawString(x.ToString(),Font,Brushes.White,origin.X+x*cell,origin.Y-22);
        for(var y=0;y<rows.Count;y++)e.Graphics.DrawString(y.ToString(),Font,Brushes.White,origin.X-28,origin.Y+y*cell);
    }
    private static Rectangle Area(Point a,Point b)=>Rectangle.FromLTRB(Math.Min(a.X,b.X),Math.Min(a.Y,b.Y),Math.Max(a.X,b.X)+1,Math.Max(a.Y,b.Y)+1);
    private static IEnumerable<(int x,int y)> Cells(Rectangle r) {for(var y=r.Top;y<r.Bottom;y++)for(var x=r.Left;x<r.Right;x++)yield return(x,y);}
    private static IEnumerable<(int x,int y)> Line(Point a,Point b)
    {int steps=Math.Max(Math.Abs(b.X-a.X),Math.Abs(b.Y-a.Y));for(var i=0;i<=steps;i++)yield return(steps==0?a.X:a.X+(int)Math.Round((b.X-a.X)*(double)i/steps),steps==0?a.Y:a.Y+(int)Math.Round((b.Y-a.Y)*(double)i/steps));}
    protected override void OnMouseDown(MouseEventArgs e)
    {
        base.OnMouseDown(e);Focus();if(Document is null)return;
        if(e.Button==MouseButtons.Middle||Tool=="Pan") {panning=true;panStart=e.Location;Capture=true;return;}
        if(e.Button!=MouseButtons.Left)return;
        start=last=Tile(e.Location);var model=Document.Model;
        if(start.X<0||start.Y<0||start.X>=MapDocument.Number(model,"width")||start.Y>=MapDocument.Number(model,"height"))return;
        if(Tool=="Arrival"||Tool=="Transfer") {MarkerClicked?.Invoke(Tool,start.X,start.Y);return;}
        draft=model;drawing=true;Capture=true;
        if(Tool=="Material")EnvironmentProfiles.Paint(draft,[(start.X,start.Y)],MaterialSurface,MaterialBrush);
        else if(Tool=="Fill")
        {
            var rows=draft["geometry"]!["rows"]!.AsArray().Select(n=>n!.ToString()).ToArray();var target=rows[start.Y][start.X];
            var visited=new HashSet<(int x,int y)>();var queue=new Queue<(int x,int y)>();queue.Enqueue((start.X,start.Y));
            while(queue.TryDequeue(out var p)){if(p.x<0||p.y<0||p.y>=rows.Length||p.x>=rows[0].Length||rows[p.y][p.x]!=target||!visited.Add(p))continue;queue.Enqueue((p.x-1,p.y));queue.Enqueue((p.x+1,p.y));queue.Enqueue((p.x,p.y-1));queue.Enqueue((p.x,p.y+1));}
            MapDocument.Paint(draft,visited,Brush);
        }
        else if(Tool=="Pencil"||Tool=="Erase")MapDocument.Paint(draft,[(start.X,start.Y)],Tool=="Erase"?'#':Brush);
        Invalidate();
    }
    protected override void OnMouseMove(MouseEventArgs e)
    {
        base.OnMouseMove(e);var tile=Tile(e.Location);Status?.Invoke($"{tile.X}, {tile.Y} · {cell}px · Middle drag to pan · Wheel to zoom");
        if(panning) {origin.Offset(e.X-panStart.X,e.Y-panStart.Y);panStart=e.Location;Invalidate();return;}
        if(!drawing||draft is null)return;
        if(Tool=="Material")EnvironmentProfiles.Paint(draft,Line(last,tile),MaterialSurface,MaterialBrush);
        else if(Tool=="Pencil"||Tool=="Erase")MapDocument.Paint(draft,Line(last,tile),Tool=="Erase"?'#':Brush);
        last=new Point(Math.Clamp(tile.X,0,MapDocument.Number(draft,"width")-1),Math.Clamp(tile.Y,0,MapDocument.Number(draft,"height")-1));if(Tool=="Select")selection=Area(start,last);Invalidate();
    }
    protected override void OnMouseUp(MouseEventArgs e)
    {
        base.OnMouseUp(e);if(panning){panning=false;Capture=false;return;}if(!drawing||draft is null)return;
        try {if(Tool=="Rectangle")MapDocument.Paint(draft,Cells(Area(start,last)),Brush);if(Tool!="Select")Document!.Apply(draft);}
        catch(Exception error){MessageBox.Show(this,error.Message,"Map edit rejected");}
        finally {drawing=false;draft=null;Capture=false;Changed?.Invoke();Invalidate();}
    }
    public void Copy()
    {
        if(Document is null||selection.IsEmpty)return;var rows=Document.Model["geometry"]!["rows"]!.AsArray().Select(n=>n!.ToString()).ToArray();
        var r=Rectangle.Intersect(selection,new Rectangle(0,0,rows[0].Length,rows.Length));if(r.IsEmpty)return;
        clipboard=Enumerable.Range(r.Top,r.Height).Select(y=>rows[y].Substring(r.Left,r.Width)).ToArray();Status?.Invoke("Selection copied. Select a destination, then Paste.");
    }
    public void Paste()
    {
        if(Document is null||clipboard is null)return;var map=Document.Model;
        for(var y=0;y<clipboard.Length;y++)for(var x=0;x<clipboard[y].Length;x++)if(clipboard[y][x]!='D')MapDocument.Paint(map,[(selection.X+x,selection.Y+y)],clipboard[y][x]);
        Document.Apply(map);Changed?.Invoke();Invalidate();
    }
}
