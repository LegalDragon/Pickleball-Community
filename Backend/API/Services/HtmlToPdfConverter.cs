using System.Net;
using System.Text.RegularExpressions;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;
using QuestPDF.Helpers;

namespace Pickleball.Community.Services;

/// <summary>
/// Converts HTML content to QuestPDF elements with proper formatting.
/// Supports common WYSIWYG editor output (headers, bold, italic, lists, etc.)
/// </summary>
public static class HtmlToPdfConverter
{
    /// <summary>
    /// Renders HTML content into a QuestPDF ColumnDescriptor with proper formatting
    /// </summary>
    public static void RenderHtml(ColumnDescriptor column, string html)
    {
        if (string.IsNullOrEmpty(html))
            return;

        // Parse and render HTML blocks
        var blocks = ParseHtmlBlocks(html);
        foreach (var block in blocks)
        {
            RenderBlock(column, block);
        }
    }

    private class HtmlBlock
    {
        public string Type { get; set; } = "paragraph";
        public string Content { get; set; } = "";
        public List<HtmlBlock>? Children { get; set; }
        public int ListLevel { get; set; } = 0;
        public bool IsOrdered { get; set; } = false;
        public int OrderNumber { get; set; } = 1;
    }

    private class TextSpan
    {
        public string Text { get; set; } = "";
        public bool IsBold { get; set; }
        public bool IsItalic { get; set; }
        public bool IsUnderline { get; set; }
        public string? Link { get; set; }
    }

    private static List<HtmlBlock> ParseHtmlBlocks(string html)
    {
        var blocks = new List<HtmlBlock>();

        // Normalize line endings and whitespace
        html = html.Replace("\r\n", "\n").Replace("\r", "\n");

        // Split by block-level elements
        var blockPattern = @"(<h[1-6][^>]*>.*?</h[1-6]>|<p[^>]*>.*?</p>|<div[^>]*>.*?</div>|<ul[^>]*>.*?</ul>|<ol[^>]*>.*?</ol>|<br\s*/?>|<hr\s*/?>)";
        var parts = Regex.Split(html, blockPattern, RegexOptions.IgnoreCase | RegexOptions.Singleline);

        foreach (var part in parts)
        {
            if (string.IsNullOrWhiteSpace(part))
                continue;

            var trimmed = part.Trim();
            if (string.IsNullOrEmpty(trimmed))
                continue;

            // Header tags
            var headerMatch = Regex.Match(trimmed, @"<h([1-6])[^>]*>(.*?)</h\1>", RegexOptions.IgnoreCase | RegexOptions.Singleline);
            if (headerMatch.Success)
            {
                blocks.Add(new HtmlBlock
                {
                    Type = $"h{headerMatch.Groups[1].Value}",
                    Content = headerMatch.Groups[2].Value
                });
                continue;
            }

            // Paragraph tags
            var pMatch = Regex.Match(trimmed, @"<p[^>]*>(.*?)</p>", RegexOptions.IgnoreCase | RegexOptions.Singleline);
            if (pMatch.Success)
            {
                blocks.Add(new HtmlBlock
                {
                    Type = "paragraph",
                    Content = pMatch.Groups[1].Value
                });
                continue;
            }

            // Div tags (treat as paragraph)
            var divMatch = Regex.Match(trimmed, @"<div[^>]*>(.*?)</div>", RegexOptions.IgnoreCase | RegexOptions.Singleline);
            if (divMatch.Success)
            {
                blocks.Add(new HtmlBlock
                {
                    Type = "paragraph",
                    Content = divMatch.Groups[1].Value
                });
                continue;
            }

            // Unordered list
            var ulMatch = Regex.Match(trimmed, @"<ul[^>]*>(.*?)</ul>", RegexOptions.IgnoreCase | RegexOptions.Singleline);
            if (ulMatch.Success)
            {
                blocks.Add(ParseList(ulMatch.Groups[1].Value, false));
                continue;
            }

            // Ordered list
            var olMatch = Regex.Match(trimmed, @"<ol[^>]*>(.*?)</ol>", RegexOptions.IgnoreCase | RegexOptions.Singleline);
            if (olMatch.Success)
            {
                blocks.Add(ParseList(olMatch.Groups[1].Value, true));
                continue;
            }

            // Line break
            if (Regex.IsMatch(trimmed, @"<br\s*/?>", RegexOptions.IgnoreCase))
            {
                blocks.Add(new HtmlBlock { Type = "break" });
                continue;
            }

            // Horizontal rule
            if (Regex.IsMatch(trimmed, @"<hr\s*/?>", RegexOptions.IgnoreCase))
            {
                blocks.Add(new HtmlBlock { Type = "hr" });
                continue;
            }

            // Plain text (no block tags) - treat as paragraph
            var cleanText = StripTags(trimmed);
            if (!string.IsNullOrWhiteSpace(cleanText))
            {
                blocks.Add(new HtmlBlock
                {
                    Type = "paragraph",
                    Content = trimmed
                });
            }
        }

        return blocks;
    }

    private static HtmlBlock ParseList(string listContent, bool isOrdered)
    {
        var block = new HtmlBlock
        {
            Type = "list",
            IsOrdered = isOrdered,
            Children = new List<HtmlBlock>()
        };

        var liMatches = Regex.Matches(listContent, @"<li[^>]*>(.*?)</li>", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        int orderNum = 1;
        foreach (Match match in liMatches)
        {
            block.Children.Add(new HtmlBlock
            {
                Type = "listitem",
                Content = match.Groups[1].Value,
                IsOrdered = isOrdered,
                OrderNumber = orderNum++
            });
        }

        return block;
    }

    private static void RenderBlock(ColumnDescriptor column, HtmlBlock block)
    {
        switch (block.Type)
        {
            case "h1":
                column.Item().PaddingTop(12).PaddingBottom(6).Text(text =>
                {
                    RenderInlineContent(text, block.Content, 18, true);
                });
                break;

            case "h2":
                column.Item().PaddingTop(10).PaddingBottom(5).Text(text =>
                {
                    RenderInlineContent(text, block.Content, 16, true);
                });
                break;

            case "h3":
                column.Item().PaddingTop(8).PaddingBottom(4).Text(text =>
                {
                    RenderInlineContent(text, block.Content, 14, true);
                });
                break;

            case "h4":
            case "h5":
            case "h6":
                column.Item().PaddingTop(6).PaddingBottom(3).Text(text =>
                {
                    RenderInlineContent(text, block.Content, 12, true);
                });
                break;

            case "paragraph":
                if (!string.IsNullOrWhiteSpace(block.Content))
                {
                    column.Item().PaddingBottom(6).Text(text =>
                    {
                        RenderInlineContent(text, block.Content, 11, false);
                    });
                }
                break;

            case "list":
                RenderList(column, block);
                break;

            case "break":
                column.Item().PaddingBottom(3);
                break;

            case "hr":
                column.Item().PaddingVertical(8).LineHorizontal(1).LineColor(Colors.Grey.Medium);
                break;
        }
    }

    private static void RenderList(ColumnDescriptor column, HtmlBlock listBlock)
    {
        if (listBlock.Children == null)
            return;

        column.Item().PaddingLeft(15).PaddingBottom(6).Column(listColumn =>
        {
            foreach (var item in listBlock.Children)
            {
                listColumn.Item().Row(row =>
                {
                    // Bullet or number
                    var bullet = listBlock.IsOrdered
                        ? $"{item.OrderNumber}."
                        : "•";
                    row.ConstantItem(20).Text(bullet).FontSize(11);

                    // Content
                    row.RelativeItem().Text(text =>
                    {
                        RenderInlineContent(text, item.Content, 11, false);
                    });
                });
            }
        });
    }

    private static void RenderInlineContent(TextDescriptor text, string html, float fontSize, bool isHeaderBold)
    {
        var spans = ParseInlineSpans(html);

        foreach (var span in spans)
        {
            var spanAction = text.Span(span.Text).FontSize(fontSize);

            // Apply styles
            if (isHeaderBold || span.IsBold)
                spanAction.Bold();
            if (span.IsItalic)
                spanAction.Italic();
            if (span.IsUnderline)
                spanAction.Underline();
            if (!string.IsNullOrEmpty(span.Link))
                spanAction.FontColor(Colors.Blue.Medium).Underline();
        }
    }

    private static List<TextSpan> ParseInlineSpans(string html)
    {
        var spans = new List<TextSpan>();
        if (string.IsNullOrEmpty(html))
            return spans;

        // Track formatting state
        var currentSpan = new TextSpan();
        var formatStack = new Stack<string>();

        // Process character by character, handling inline tags
        int i = 0;
        while (i < html.Length)
        {
            if (html[i] == '<')
            {
                // Save current span if it has content
                if (!string.IsNullOrEmpty(currentSpan.Text))
                {
                    currentSpan.Text = WebUtility.HtmlDecode(currentSpan.Text);
                    spans.Add(currentSpan);
                    currentSpan = new TextSpan
                    {
                        IsBold = currentSpan.IsBold,
                        IsItalic = currentSpan.IsItalic,
                        IsUnderline = currentSpan.IsUnderline,
                        Link = currentSpan.Link
                    };
                }

                // Find tag end
                var tagEnd = html.IndexOf('>', i);
                if (tagEnd == -1)
                {
                    currentSpan.Text += html[i];
                    i++;
                    continue;
                }

                var tag = html.Substring(i, tagEnd - i + 1).ToLower();
                i = tagEnd + 1;

                // Handle opening tags
                if (tag.StartsWith("<b>") || tag.StartsWith("<strong"))
                {
                    currentSpan.IsBold = true;
                    formatStack.Push("bold");
                }
                else if (tag.StartsWith("<i>") || tag.StartsWith("<em"))
                {
                    currentSpan.IsItalic = true;
                    formatStack.Push("italic");
                }
                else if (tag.StartsWith("<u>"))
                {
                    currentSpan.IsUnderline = true;
                    formatStack.Push("underline");
                }
                else if (tag.StartsWith("<a "))
                {
                    var hrefMatch = Regex.Match(tag, @"href\s*=\s*[""']([^""']+)[""']", RegexOptions.IgnoreCase);
                    if (hrefMatch.Success)
                    {
                        currentSpan.Link = hrefMatch.Groups[1].Value;
                    }
                    formatStack.Push("link");
                }
                // Handle closing tags
                else if (tag == "</b>" || tag == "</strong>")
                {
                    currentSpan.IsBold = false;
                    if (formatStack.Count > 0 && formatStack.Peek() == "bold")
                        formatStack.Pop();
                }
                else if (tag == "</i>" || tag == "</em>")
                {
                    currentSpan.IsItalic = false;
                    if (formatStack.Count > 0 && formatStack.Peek() == "italic")
                        formatStack.Pop();
                }
                else if (tag == "</u>")
                {
                    currentSpan.IsUnderline = false;
                    if (formatStack.Count > 0 && formatStack.Peek() == "underline")
                        formatStack.Pop();
                }
                else if (tag == "</a>")
                {
                    // Add link URL in parentheses
                    if (!string.IsNullOrEmpty(currentSpan.Link))
                    {
                        if (!string.IsNullOrEmpty(currentSpan.Text))
                        {
                            currentSpan.Text = WebUtility.HtmlDecode(currentSpan.Text);
                            spans.Add(currentSpan);
                        }
                        spans.Add(new TextSpan { Text = $" ({currentSpan.Link})" });
                        currentSpan = new TextSpan();
                    }
                    currentSpan.Link = null;
                    if (formatStack.Count > 0 && formatStack.Peek() == "link")
                        formatStack.Pop();
                }
                // Handle <br> as space
                else if (tag.StartsWith("<br"))
                {
                    currentSpan.Text += " ";
                }
            }
            else
            {
                currentSpan.Text += html[i];
                i++;
            }
        }

        // Add final span
        if (!string.IsNullOrEmpty(currentSpan.Text))
        {
            currentSpan.Text = WebUtility.HtmlDecode(currentSpan.Text);
            spans.Add(currentSpan);
        }

        // If no spans were created, create one with cleaned text
        if (spans.Count == 0 && !string.IsNullOrWhiteSpace(html))
        {
            spans.Add(new TextSpan { Text = WebUtility.HtmlDecode(StripTags(html)) });
        }

        return spans;
    }

    private static string StripTags(string html)
    {
        return Regex.Replace(html, "<[^>]+>", "");
    }
}
