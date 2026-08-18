---
id: "01M02XSPBAZDE0QWGW5ASJHMVH"
cta_label: "Let's talk data"
excerpt: "A data pipeline comes together quickly. A platform that survives years of business, schema changes, campaign peaks and shifting data sources is another story. [Medallion](https://dataengineering.wiki/Concepts/Medallion+Architecture) architecture, and tests that number in the thousands."
---

Anyone can stand up a pipeline in an afternoon. A platform that survives years of business, schema changes and campaign peaks is another story.

We build them the way [serious software](/en/greenfield-development) gets built. Every transformation versioned in `git`, every dataset tested, every flow wired to an alert.

The essence is analytical, and the synergies with the operational side multiply it. We run [`dbt`](https://www.getdbt.com/) on both sides of the *warehouse*.

## dbt ≠ pipeline

`dbt` is the T in [`ELT`](https://www.getdbt.com/blog/extract-load-transform), and we treat it the way good software gets treated, the pattern the industry calls [*analytics engineering*](https://www.getdbt.com/what-is-analytics-engineering). But the tool is only one piece: ingestion, orchestration and monitoring live elsewhere, and our value is building and running the whole set.

- **Google Cloud is where we've gone deepest**. [`BigQuery`](https://cloud.google.com/bigquery) as the *warehouse*, `dbt` for the transformations.
- **From blueprint to publication**. Our [*definition of done*](https://scrumguides.org/scrum-guide.html#commitment-definition-of-done) starts long before the code. Database design following the [sector's classic modeling](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/), standard naming, homogenization and normalization of the data. It is more analysis than development, and it is where reliability is won.
- **Testing is the part most teams skip**. On our platforms tests number in the thousands. *Unit tests* run before anything ships, and *data tests* run every day, with every load. Data that fails never reaches *gold*.
- **Layered architecture**. The [*medallion*](https://dataengineering.wiki/Concepts/Medallion+Architecture) pattern keeps raw and verified data apart, each layer with its purpose and its access control.
- **Infrastructure is code too**. [`Terraform`](https://www.terraform.io/) builds the same datasets, permissions and environments in development and in production.
- **Real time when the business needs it**. Ingestion on [`Pub/Sub`](https://cloud.google.com/pubsub) and [`Dataflow`](https://cloud.google.com/dataflow) for the flows that can't wait for the nightly *batch*.

## Synergies between analytical and operational

> "One way of working for two divergent worlds."

On the analytical side we work with [`dbt Cloud`](https://docs.getdbt.com/docs/platform/about-platform/dbt-platform-features) on `BigQuery`. And when a transformation belongs in the operational layer, on a relational database like `Oracle`, we manage it with [`dbt Core`](https://github.com/dbt-labs/dbt-core) and the [adapter Oracle maintains](https://github.com/oracle/dbt-oracle) (plus our own improvements, as obvious as they were necessary...).

The same tests and the same versioning on both sides, with no toll booths between teams. Data reaches the dashboard already proven.

We connect `BigQuery` to [your e-commerce](/en/e-commerce), to your [ERP](/en/systems-integration), and to the [*edge*](/en/cdn-waf-edge-security-cloudflare).
