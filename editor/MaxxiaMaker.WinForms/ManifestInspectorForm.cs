using MaxxiaMaker.ProjectModel;

namespace MaxxiaMaker;

public sealed class ManifestInspectorForm : Form
{
    public ManifestInspectorForm(string filename, ProjectManifest manifest)
    {
        Text = $"Manifest — {manifest.Title}";
        StartPosition = FormStartPosition.CenterParent;
        ClientSize = new Size(940, 650); MinimumSize = new Size(650, 450);
        AutoScaleMode = AutoScaleMode.Dpi;
        Font = new Font("Segoe UI", 10F);
        var tabs = new TabControl { Dock = DockStyle.Fill };
        var summary = new TabPage("Summary");
        var fields = new ListView { Dock = DockStyle.Fill, View = View.Details, FullRowSelect = true, HeaderStyle = ColumnHeaderStyle.Nonclickable };
        fields.Columns.Add("Field", 210); fields.Columns.Add("Value", 660);
        void Field(string name, string value) => fields.Items.Add(new ListViewItem([name, value]));
        Field("Validation", "Valid manifest — read-only preview");
        Field("File", filename); Field("Title", manifest.Title); Field("Project ID", manifest.ProjectId);
        Field("Project format", manifest.ProjectFormatVersion.ToString()); Field("Content revision", manifest.ContentRevision.ToString());
        Field("Authored engine", manifest.EngineVersion); Field("Minimum engine", manifest.MinimumEngineVersion);
        Field("Current engine", ManifestContract.CurrentEngineVersion); Field("Content adapter", manifest.Content.Kind);
        Field("Starting map", manifest.Start.Map.Id); Field("Starting position", $"{manifest.Start.X}, {manifest.Start.Y} / facing {manifest.Start.Facing}");
        Field("Starting party", string.Join(", ", manifest.StartingParty.Select(a => a.Id)));
        Field("Content resolution", "File/record existence is checked by game startup, not this manifest preview.");
        summary.Controls.Add(fields);
        var json = new TabPage("Validated JSON");
        json.Controls.Add(new TextBox
        {
            Dock = DockStyle.Fill, Multiline = true, ReadOnly = true, WordWrap = false,
            ScrollBars = ScrollBars.Both, Font = new Font("Consolas", 10F), Text = ManifestReader.Serialize(manifest)
        });
        tabs.TabPages.AddRange([summary, json]); Controls.Add(tabs);
    }
}
