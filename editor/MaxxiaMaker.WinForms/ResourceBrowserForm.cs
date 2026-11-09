using MaxxiaMaker.ProjectModel;

namespace MaxxiaMaker;

/// <summary>MM05: native read-only catalogue browser. Import, relink and animation editing come in MM22.</summary>
public sealed class ResourceBrowserForm : Form
{
    private readonly ResourceCatalogDocument catalog;
    private readonly ListView list = new() { Dock = DockStyle.Fill, View = View.Details, FullRowSelect = true, HideSelection = false, MultiSelect = false };
    private readonly ComboBox kind = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 135 };
    private readonly TextBox search = new() { Width = 290, PlaceholderText = "Search names, IDs, paths" };
    private readonly PictureBox preview = new() { SizeMode = PictureBoxSizeMode.Zoom, Dock = DockStyle.Fill, BackColor = Color.FromArgb(226, 231, 238) };
    private readonly Label details = new() { Dock = DockStyle.Bottom, Height = 105, AutoEllipsis = true, Padding = new Padding(7) };
    private readonly Label count = new() { AutoSize = true, Margin = new Padding(10, 8, 0, 0) };
    private Bitmap? thumbnail;
    private readonly ImageList rowPreviews = new() { ImageSize = new Size(42, 42), ColorDepth = ColorDepth.Depth32Bit };
    public ResourceBrowserForm(ResourceCatalogDocument catalog)
    {
        this.catalog = catalog;
        Text = "Maxxia Maker — Resources (read-only)"; ClientSize = new Size(1120, 730); MinimumSize = new Size(680, 450);
        Font = new Font("Segoe UI", 9F); AutoScaleMode = AutoScaleMode.Dpi;
        kind.Items.AddRange(["All kinds", "Images", "Audio", "Fonts", "Missing files"]); kind.SelectedIndex = 0;
        var filters = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 42, Padding = new Padding(7, 4, 0, 0), WrapContents = false };
        filters.Controls.Add(kind); filters.Controls.Add(search); filters.Controls.Add(count);
        list.SmallImageList = rowPreviews;
        list.Columns.Add("Name", 170); list.Columns.Add("Kind", 65); list.Columns.Add("Stable ID", 300); list.Columns.Add("Relative path", 370); list.Columns.Add("File", 75);
        var splitter = new SplitContainer { Dock = DockStyle.Fill, SplitterDistance = 735, Panel1MinSize = 320, Panel2MinSize = 230 };
        splitter.Panel1.Controls.Add(list);
        var right = new Panel { Dock = DockStyle.Fill }; right.Controls.Add(preview); right.Controls.Add(details);
        splitter.Panel2.Controls.Add(right);
        Controls.Add(splitter); Controls.Add(filters);
        kind.SelectedIndexChanged += (_, _) => Filter(); search.TextChanged += (_, _) => Filter();
        list.SelectedIndexChanged += (_, _) => ShowPreview();
        FormClosed += (_, _) => { thumbnail?.Dispose(); preview.Image = null; rowPreviews.Dispose(); };
        Filter();
    }
    private void Filter()
    {
        list.BeginUpdate(); list.Items.Clear(); rowPreviews.Images.Clear();
        int rendered = 0;
        foreach (var item in catalog.Resources)
        {
            bool show = kind.SelectedIndex switch { 1 => item.Kind == "image", 2 => item.Kind == "audio", 3 => item.Kind == "font", 4 => !item.Exists, _ => true };
            if (!show || !string.Join(" ", item.Name, item.Id, item.RelativePath).Contains(search.Text, StringComparison.OrdinalIgnoreCase)) continue;
            var row = new ListViewItem([item.Name, item.Kind, item.Id, item.RelativePath, item.Exists ? "OK" : "MISSING"]) { Tag = item };
            if (!item.Exists) row.ForeColor = Color.DarkRed;
            if (item.Kind == "image" && item.Exists && rendered < 64 && !item.FilePath.EndsWith(".svg", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    using var stream = File.Open(item.FilePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                    using var original = Image.FromStream(stream);
                    using var thumb = new Bitmap(42, 42);
                    using (var paint = Graphics.FromImage(thumb))
                    {
                        paint.Clear(Color.Transparent);
                        var scale = Math.Min(42F / original.Width, 42F / original.Height);
                        var size = new SizeF(original.Width * scale, original.Height * scale);
                        paint.DrawImage(original, (42 - size.Width) / 2, (42 - size.Height) / 2, size.Width, size.Height);
                    }
                    rowPreviews.Images.Add(thumb);
                    row.ImageIndex = rowPreviews.Images.Count - 1;
                    rendered++;
                }
                catch { /* Unsupported/invalid raster: metadata and missing-resource status remain visible. */ }
            }
            list.Items.Add(row);
        }
        list.EndUpdate();
        count.Text = $"{list.Items.Count} shown / {catalog.Resources.Count} assets • {catalog.Resources.Count(x => !x.Exists)} missing";
        ShowPreview();
    }
    private void ShowPreview()
    {
        preview.Image = null; thumbnail?.Dispose(); thumbnail = null;
        if (list.SelectedItems.Count != 1 || list.SelectedItems[0].Tag is not ResourceRecord item) { details.Text = "Select a resource to view its metadata and image preview."; return; }
        details.Text = $"{item.Id}\n{item.RelativePath}\n{(item.Exists ? "File exists" : "MISSING RESOURCE — inspect catalogue path")}\n{(item.LegacyPath is null ? "ID-based only" : "Legacy: " + item.LegacyPath)}";
        if (!item.Exists || item.Kind != "image" || Path.GetExtension(item.FilePath).Equals(".svg", StringComparison.OrdinalIgnoreCase)) return;
        try
        {
            // Clone from a stream to avoid locking project image files while browsing.
            using var stream = File.Open(item.FilePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            using var loaded = Image.FromStream(stream);
            thumbnail = new Bitmap(loaded); preview.Image = thumbnail;
        }
        catch (Exception e) { details.Text += "\nPreview unavailable: " + e.Message; }
    }
}
