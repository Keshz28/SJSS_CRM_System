import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

Font.register({
  family: "Inter",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiJ-Ek-_EeA.woff",
      fontWeight: 600,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff",
      fontWeight: 700,
    },
  ],
});

const PRIMARY = "#5B8FF9";
const DARK = "#26264F";
const MUTED = "#8B8BAE";
const BORDER = "#E5E7EB";
const BG_LIGHT = "#F8F9FC";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 9,
    color: DARK,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
  },
  companyName: {
    fontSize: 20,
    fontWeight: 700,
    color: PRIMARY,
  },
  companyTagline: {
    fontSize: 8,
    color: MUTED,
    marginTop: 2,
  },
  companyMeta: {
    fontSize: 7.5,
    color: MUTED,
    marginTop: 1,
    lineHeight: 1.4,
    maxWidth: 240,
  },
  quotationLabel: {
    fontSize: 9,
    color: MUTED,
    textAlign: "right",
  },
  quotationNumber: {
    fontSize: 16,
    fontWeight: 700,
    color: DARK,
    textAlign: "right",
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: "#EEF3FF",
    color: PRIMARY,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    fontSize: 8,
    fontWeight: 600,
    textAlign: "right",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  section: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 24,
  },
  infoBlock: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 7,
    color: MUTED,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 9,
    color: DARK,
    lineHeight: 1.5,
  },
  infoBold: {
    fontSize: 10,
    fontWeight: 700,
    color: DARK,
    marginBottom: 2,
  },
  table: {
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: DARK,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 2,
  },
  tableHeaderText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: 600,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRowAlt: {
    backgroundColor: BG_LIGHT,
  },
  colDescription: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1.5, textAlign: "right" },
  colTotal: { flex: 1.5, textAlign: "right" },
  tableFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  totalsBox: {
    width: 180,
    borderTopWidth: 2,
    borderTopColor: PRIMARY,
    paddingTop: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 9,
    color: MUTED,
  },
  totalValue: {
    fontSize: 9,
    color: DARK,
    fontWeight: 600,
  },
  grandTotalLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: DARK,
  },
  grandTotalValue: {
    fontSize: 11,
    fontWeight: 700,
    color: PRIMARY,
  },
  notesSection: {
    marginTop: 20,
    padding: 12,
    backgroundColor: BG_LIGHT,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: PRIMARY,
  },
  notesLabel: {
    fontSize: 7,
    color: MUTED,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 8,
    color: DARK,
    lineHeight: 1.5,
  },
  termsSection: {
    marginTop: 12,
  },
  termsText: {
    fontSize: 7.5,
    color: MUTED,
    lineHeight: 1.6,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: MUTED,
  },
});

function formatMYR(amount: number) {
  return `MYR ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusDisplay(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

interface CompanyData {
  name: string;
  tagline?: string | null;
  registrationNo?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

interface QuotationData {
  quotationNumber: string;
  status: string;
  subject?: string | null;
  createdAt: string;
  validUntil?: string | null;
  notes?: string | null;
  terms?: string | null;
  totalAmount: number;
  company: CompanyData;
  customer: {
    name: string;
    contactPerson?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
  };
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  createdBy: { name: string };
}

export function QuotationPDF({ data }: { data: QuotationData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{data.company.name}</Text>
            {data.company.tagline ? (
              <Text style={styles.companyTagline}>{data.company.tagline}</Text>
            ) : null}
            {data.company.registrationNo ? (
              <Text style={styles.companyMeta}>Reg. No: {data.company.registrationNo}</Text>
            ) : null}
            {data.company.address ? (
              <Text style={styles.companyMeta}>{data.company.address}</Text>
            ) : null}
            {data.company.city ? (
              <Text style={styles.companyMeta}>{data.company.city}</Text>
            ) : null}
            {(data.company.phone || data.company.email) ? (
              <Text style={styles.companyMeta}>
                {[data.company.phone, data.company.email].filter(Boolean).join("  •  ")}
              </Text>
            ) : null}
            {data.company.website ? (
              <Text style={styles.companyMeta}>{data.company.website}</Text>
            ) : null}
          </View>
          <View>
            <Text style={styles.quotationLabel}>QUOTATION</Text>
            <Text style={styles.quotationNumber}>{data.quotationNumber}</Text>
            <Text style={styles.statusBadge}>{statusDisplay(data.status)}</Text>
          </View>
        </View>

        {/* Bill To + Dates */}
        <View style={styles.section}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Bill To</Text>
            <Text style={styles.infoBold}>{data.customer.name}</Text>
            {data.customer.contactPerson && (
              <Text style={styles.infoValue}>{data.customer.contactPerson}</Text>
            )}
            {data.customer.address && (
              <Text style={styles.infoValue}>{data.customer.address}</Text>
            )}
            {data.customer.city && (
              <Text style={styles.infoValue}>{data.customer.city}</Text>
            )}
            {data.customer.email && (
              <Text style={styles.infoValue}>{data.customer.email}</Text>
            )}
            {data.customer.phone && (
              <Text style={styles.infoValue}>{data.customer.phone}</Text>
            )}
          </View>

          <View style={[styles.infoBlock, { alignItems: "flex-end" }]}>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              {data.subject && (
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.infoLabel}>Subject</Text>
                  <Text style={[styles.infoValue, { fontWeight: 600, textAlign: "right" }]}>
                    {data.subject}
                  </Text>
                </View>
              )}
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.infoLabel}>Date</Text>
                <Text style={styles.infoValue}>{formatDate(data.createdAt)}</Text>
              </View>
              {data.validUntil && (
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.infoLabel}>Valid Until</Text>
                  <Text style={styles.infoValue}>{formatDate(data.validUntil)}</Text>
                </View>
              )}
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.infoLabel}>Prepared By</Text>
                <Text style={styles.infoValue}>{data.createdBy.name}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Items table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colDescription]}>Description</Text>
            <Text style={[styles.tableHeaderText, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderText, styles.colPrice]}>Unit Price</Text>
            <Text style={[styles.tableHeaderText, styles.colTotal]}>Amount</Text>
          </View>
          {data.items.map((item, idx) => (
            <View
              key={idx}
              style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={[styles.colDescription]}>{item.description}</Text>
              <Text style={[styles.colQty]}>{Number(item.quantity).toFixed(2)}</Text>
              <Text style={[styles.colPrice]}>{formatMYR(Number(item.unitPrice))}</Text>
              <Text style={[styles.colTotal]}>{formatMYR(Number(item.total))}</Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={styles.tableFooter}>
          <View style={styles.totalsBox}>
            <View style={[styles.totalRow, { borderTopWidth: 0 }]}>
              <Text style={styles.grandTotalLabel}>TOTAL</Text>
              <Text style={styles.grandTotalValue}>{formatMYR(Number(data.totalAmount))}</Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{data.notes}</Text>
          </View>
        )}

        {/* Terms */}
        {data.terms && (
          <View style={styles.termsSection}>
            <Text style={[styles.notesLabel, { marginBottom: 4 }]}>Terms & Conditions</Text>
            <Text style={styles.termsText}>{data.terms}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {data.quotationNumber} — {data.company.name}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
