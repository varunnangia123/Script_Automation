# SharePoint List Monitor

A static GitHub Pages website that signs in with Microsoft Graph, watches a SharePoint list column for a target value, and refreshes the matching rows every 10 seconds while the browser tab is open.

## What It Does

- Signs in with Microsoft Entra ID using MSAL in the browser.
- Reads a SharePoint Online list through Microsoft Graph.
- Finds rows where one list field exactly matches the configured value.
- Refreshes the table every 10 seconds or more.
- Stores the non-secret monitor settings in browser local storage.

## Run Locally

Open `index.html` in a browser, or serve this folder with any static web server.

## GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository, open Settings > Pages.
3. Select the branch and folder that contains `index.html`.
4. Open the published GitHub Pages URL.

The page is static. The monitor only runs while the browser tab is open.

## Microsoft Entra App Registration

Create a public client app registration before using the page against a private SharePoint site.

1. In Microsoft Entra admin center, create an app registration.
2. Add a Single-page application redirect URI for the actual page URL, for example `https://your-user.github.io/your-repo/sharepoint-list-monitor/` if you publish this folder under the repository root.
3. Add delegated Microsoft Graph permission `Sites.Read.All`.
4. Grant admin consent if your tenant requires it.
5. Copy the tenant ID or tenant domain and the application client ID into the website.

No client secret is used or stored because GitHub Pages is a public static host.

## Monitor Settings

- Tenant ID or domain: your Entra tenant, for example `contoso.onmicrosoft.com`.
- Application client ID: the public client app ID from Entra.
- SharePoint list URL: optional full list URL. The app can fill the host, site path, and list name from this.
- SharePoint host: for example `contoso.sharepoint.com`.
- Site path: for example `/sites/ChangeManagement`.
- List name or ID: the list display name or GUID.
- Column internal name: the SharePoint field internal name, not always the display label.
- Value to match: the exact value to return rows for, case-insensitive.
- Columns to show: optional comma-separated list of fields to display.

## Company SharePoint Lists

Company SharePoint links work, but GitHub Pages cannot read them with your existing SharePoint browser session. The page must sign in through Microsoft Entra ID and call Microsoft Graph.

For this list URL:

```text
https://utilnsw.sharepoint.com/teams/PortfolioReporting/Lists/Change%20Requests/AllItems.aspx
```

The monitor detects:

```text
SharePoint host: utilnsw.sharepoint.com
Site path: /teams/PortfolioReporting
List name or ID: Change Requests
```

You still need the company tenant ID or verified tenant domain and an approved Entra application client ID. The SharePoint host is not always the tenant authority, so use the tenant value provided by your Entra administrator if sign-in fails.

## Notes

Microsoft Graph returns SharePoint field internal names. If a column was renamed, its internal name can differ from the display name.

The app reads up to 20 Graph pages of 200 list items each. For large lists, index the monitored column or narrow the list design so the browser does not need to scan thousands of rows every 10 seconds.
