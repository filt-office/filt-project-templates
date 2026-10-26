# FILT Project Templates

Shared responsive project-detail template and common site navigation for FILT's Imweb project pages.

## Files

- `project-template.js` renders desktop and mobile layouts from a project ID.
- `project-template.css` contains shared responsive styles.
- `common-menu-v2.js` provides the desktop sidebar and mobile navigation.
- `home-button.js` provides desktop and mobile home buttons.
- `projects/tempin.json` contains Tempin Office project content and image references.

The project layout, image-gallery interaction, common menu, and home button all switch at **768px and below**. Keep the file paths and directory structure intact when hosting.

## Imweb code widget

Add one code widget to the project detail page body. The same code is used for desktop and mobile; the layout responds to viewport width.

After creating this repository, replace `<commit-sha>` with the published commit ID:

```html
<div class="filt-project-mount" data-filt-project="tempin"></div>
<script
  src="https://cdn.jsdelivr.net/gh/filtehwa/filt-project-templates@<commit-sha>/project-template.js"
  data-project-id="tempin">
</script>
```

The repository needs to be public for jsDelivr access. To use another project, add `projects/<project-id>.json` and change both `tempin` values in the widget to that project ID.

## Project data

`projects/tempin.json` contains gallery image URLs, description HTML, overview fields, and mobile drawing data. Images remain hosted at their current Imweb/GitHub asset URLs; they are not copied into this repository.

The overview table is generated from `overview.fields`. Add or remove field objects to adjust its rows. Supplementary text, images, and captions are defined by `descriptionHtml`.
