// Demo topology data — generic systems, zero proprietary names
// Models a realistic e-commerce integration landscape
globalThis.routesDataCsv = `flow_name,flow_type,direction,system,service,component,entity,operation,protocol,host,endpoint
order_erp2wms_sync,route,inbound,erp,api,orders-api,order,read,https,erp.internal,/api/v2/orders
order_erp2wms_sync,route,outbound,middleware,queue,orders.pending,order,publish,amqp,broker.internal,orders.pending
order_erp2wms_sync,route,outbound,wms,api,warehouse-intake,order,write,https,wms.internal,/api/v1/intake
stock_wms2ecom_update,route,inbound,wms,api,stock-levels,stock,read,https,wms.internal,/api/v1/stock
stock_wms2ecom_update,route,outbound,middleware,queue,stock.updates,stock,publish,amqp,broker.internal,stock.updates
stock_wms2ecom_update,route,outbound,ecommerce,api,catalog-stock,stock,write,https,shop.internal,/api/v2/catalog/stock
customer_crm2analytics,route,inbound,crm,api,customer-export,customer,read,https,crm.internal,/api/v1/customers/export
customer_crm2analytics,route,outbound,gcp,gcs,customer-raw-export,customer,write,gs,storage.googleapis.com,gs://data-lake/customers/raw/
customer_crm2analytics,route,outbound,gcp,gbq,analytics.customers,customer,write,sql,bigquery.googleapis.com,bigquery://analytics/customers
invoice_erp2sftp_export,route,inbound,erp,database,invoices-db,invoice,read,sql,db.internal,jdbc:postgresql://erp-db/invoices
invoice_erp2sftp_export,route,outbound,partner,sftp,partner-invoices,invoice,write,sftp,sftp.partner.com,/incoming/invoices/
price_ecom2erp_sync,route,inbound,ecommerce,api,price-engine,price,read,https,shop.internal,/api/v2/pricing
price_ecom2erp_sync,route,outbound,middleware,queue,prices.changed,price,publish,amqp,broker.internal,prices.changed
price_ecom2erp_sync,route,outbound,erp,api,price-update,price,write,https,erp.internal,/api/v2/prices
demand_analytics2wms,job,inbound,gcp,gbq,analytics.demand_forecast,demand,read,sql,bigquery.googleapis.com,bigquery://analytics/demand_forecast
demand_analytics2wms,job,outbound,wms,api,replenishment,demand,write,https,wms.internal,/api/v1/replenishment
returns_ecom2erp,route,inbound,ecommerce,api,returns-api,return,read,https,shop.internal,/api/v2/returns
returns_ecom2erp,route,outbound,middleware,queue,returns.pending,return,publish,amqp,broker.internal,returns.pending
returns_ecom2erp,route,outbound,erp,api,returns-intake,return,write,https,erp.internal,/api/v2/returns
product_erp2ecom_catalog,route,inbound,erp,database,products-db,product,read,sql,db.internal,jdbc:postgresql://erp-db/products
product_erp2ecom_catalog,route,outbound,ecommerce,api,catalog-products,product,write,https,shop.internal,/api/v2/catalog/products
product_erp2ecom_catalog,route,outbound,gcp,gcs,product-images,product,write,gs,storage.googleapis.com,gs://media-assets/products/
loyalty_crm2ecom,route,inbound,crm,api,loyalty-points,loyalty,read,https,crm.internal,/api/v1/loyalty/balance
loyalty_crm2ecom,route,outbound,ecommerce,api,loyalty-sync,loyalty,write,https,shop.internal,/api/v2/loyalty
shipment_wms2partner,route,inbound,wms,api,shipment-tracking,shipment,read,https,wms.internal,/api/v1/shipments
shipment_wms2partner,route,outbound,partner,sftp,tracking-export,shipment,write,sftp,sftp.partner.com,/incoming/tracking/
analytics_daily_etl,job,inbound,erp,database,sales-db,sales,read,sql,db.internal,jdbc:postgresql://erp-db/sales
analytics_daily_etl,job,outbound,gcp,gcs,sales-raw-export,sales,write,gs,storage.googleapis.com,gs://data-lake/sales/raw/
analytics_daily_etl,job,outbound,gcp,gbq,analytics.sales,sales,write,sql,bigquery.googleapis.com,bigquery://analytics/sales`;

// Demo catalog — simplified migration metadata
globalThis.MIGRATION_CATALOG = [
  { flow_name: 'order_erp2wms_sync', owner: 'OPS', entity: 'Order', project: 'E-Commerce', source_system: 'ERP', target_system: 'WMS', description: 'Synchronizes new orders from ERP to warehouse management' },
  { flow_name: 'stock_wms2ecom_update', owner: 'OPS', entity: 'Stock', project: 'E-Commerce', source_system: 'WMS', target_system: 'eCommerce', description: 'Real-time stock level updates from warehouse to storefront' },
  { flow_name: 'customer_crm2analytics', owner: 'DATA', entity: 'Customer', project: 'Analytics', source_system: 'CRM', target_system: 'BigQuery', description: 'Customer data export to analytics data lake' },
  { flow_name: 'invoice_erp2sftp_export', owner: 'FIN', entity: 'Invoice', project: 'Finance', source_system: 'ERP', target_system: 'Partner SFTP', description: 'Automated invoice delivery to partners via SFTP' },
  { flow_name: 'price_ecom2erp_sync', owner: 'OPS', entity: 'Price', project: 'E-Commerce', source_system: 'eCommerce', target_system: 'ERP', description: 'Price changes from commerce platform back to ERP master' },
  { flow_name: 'demand_analytics2wms', owner: 'DATA', entity: 'Demand', project: 'Supply Chain', source_system: 'BigQuery', target_system: 'WMS', description: 'Demand forecast from analytics drives warehouse replenishment' },
  { flow_name: 'returns_ecom2erp', owner: 'OPS', entity: 'Return', project: 'E-Commerce', source_system: 'eCommerce', target_system: 'ERP', description: 'Return requests flow from storefront to ERP for processing' },
  { flow_name: 'product_erp2ecom_catalog', owner: 'OPS', entity: 'Product', project: 'E-Commerce', source_system: 'ERP', target_system: 'eCommerce', description: 'Product catalog sync from ERP master to storefront' },
  { flow_name: 'loyalty_crm2ecom', owner: 'MKT', entity: 'Loyalty', project: 'Customer', source_system: 'CRM', target_system: 'eCommerce', description: 'Loyalty points balance sync to commerce platform' },
  { flow_name: 'shipment_wms2partner', owner: 'OPS', entity: 'Shipment', project: 'Logistics', source_system: 'WMS', target_system: 'Partner SFTP', description: 'Shipment tracking data export to logistics partners' },
  { flow_name: 'analytics_daily_etl', owner: 'DATA', entity: 'Sales', project: 'Analytics', source_system: 'ERP', target_system: 'BigQuery', description: 'Daily sales data ETL from ERP to analytics warehouse' }
];
