using System.Text.Json.Nodes;
using MaxxiaMaker.Documents;
using MaxxiaMaker.ProjectModel;

namespace MaxxiaMaker;

public sealed class ProjectSettingsDialog : Form
{
    private readonly TextBox title = new() { Dock = DockStyle.Fill, MaxLength = 240 };
    private readonly NumericUpDown revision = new() { Minimum = 1, Maximum = int.MaxValue, Dock = DockStyle.Fill };
    private readonly NumericUpDown x = new() { Minimum = 0, Maximum = 63, Dock = DockStyle.Fill };
    private readonly NumericUpDown y = new() { Minimum = 0, Maximum = 63, Dock = DockStyle.Fill };
    private readonly ComboBox facing = new() { DropDownStyle = ComboBoxStyle.DropDownList, Dock = DockStyle.Fill };
    private readonly string original;
    public string EditedJson
    {
        get
        {
            var json = JsonNode.Parse(original)!.AsObject(); json["title"] = title.Text; json["contentRevision"] = (int)revision.Value;
            json["start"]!["x"] = (int)x.Value; json["start"]!["y"] = (int)y.Value; json["start"]!["facing"] = facing.SelectedIndex;
            return json.ToJsonString();
        }
    }
    public ProjectSettingsDialog(ProjectDocument document)
    {
        original = document.Text; var model = document.Model;
        Text = "Project settings"; StartPosition = FormStartPosition.CenterParent; FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false; MinimizeBox = false; AutoScaleMode = AutoScaleMode.Dpi; ClientSize = new Size(620, 340);
        Font = new Font("Segoe UI", 10F);
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2, RowCount = 7, Padding = new Padding(18) };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 150)); layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        void Add(string label, Control control, int row) { layout.Controls.Add(new Label { Text = label, AutoSize = true, Anchor = AnchorStyles.Left }, 0, row); layout.Controls.Add(control, 1, row); }
        Add("Project ID", new TextBox { ReadOnly = true, Text = model.ProjectId, Dock = DockStyle.Fill }, 0);
        title.Text = model.Title; revision.Value = model.ContentRevision; x.Value = model.Start.X; y.Value = model.Start.Y;
        facing.Items.AddRange(["North", "East", "South", "West"]); facing.SelectedIndex = model.Start.Facing;
        Add("Game title", title, 1); Add("Content revision", revision, 2); Add("Starting X", x, 3); Add("Starting Y", y, 4); Add("Starting facing", facing, 5);
        var buttons = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.RightToLeft, AutoSize = true };
        var cancel = new Button { Text = "Cancel", AutoSize = true, DialogResult = DialogResult.Cancel };
        var apply = new Button { Text = "Apply", AutoSize = true, DialogResult = DialogResult.OK };
        buttons.Controls.Add(cancel); buttons.Controls.Add(apply); layout.Controls.Add(buttons, 1, 6);
        AcceptButton = apply; CancelButton = cancel; Controls.Add(layout);
        FormClosing += (_, e) =>
        {
            if (DialogResult != DialogResult.OK) return;
            try { _ = ManifestReader.Read(EditedJson); }
            catch (ManifestException error)
            {
                e.Cancel = true; DialogResult = DialogResult.None;
                MessageBox.Show(this, error.Message, "Invalid settings", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        };
    }
}
