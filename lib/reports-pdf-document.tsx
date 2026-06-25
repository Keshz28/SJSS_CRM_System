import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { PeriodBucket } from "@/lib/report-periods";

const PRIMARY = "#5B8FF9";
const DARK = "#26264F";
const MUTED = "#8B8BAE";
const BORDER = "#E5E7EB";
const BG_LIGHT = "#F8F9FC";
const ACCENT = "#CB3CFF";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
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
    marginBottom: 28,
    paddingBottom: 18,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
  },
  companyName: { fontSize: 18, fontWeight: 700, color: PRIMARY },
  companyMeta: { fontSize: 7.5, color: MUTED, marginTop: 1, lineHeight: 1.4, maxWidth: 240 },
  reportLabel: { fontSize: 9, color: MUTED, textAlign: "right" },
  reportTitle: { fontSize: 15, fontWeight: 700, color: DARK, textAlign: "right", marginTop: 2 },
  reportMeta: { fontSize: 7.5, color: MUTED, textAlign: "right", marginTop: 3 },

  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: DARK,
    marginBottom: 8,
    marginTop: 18,
  },

  // Stat cards
  statRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  statCard: {
    flex: 1,
    backgroundColor: BG_LIGHT,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: PRIMARY,
    padding: 10,
  },
  statLabel: { fontSize: 7, color: MUTED, fontWeight: 600 },
  statValue: { fontSize: 13, fontWeight: 700, color: DARK, marginTop: 3 },

  // Tables
  tableHeader: {
    flexDirection: "row",
    backgroundColor: DARK,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 2,
  },
  tableHeaderText: { color: "#FFFFFF", fontSize: 8, fontWeight: 600 },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRowAlt: { backgroundColor: BG_LIGHT },
  cell: { fontSize: 8.5, color: DARK },

  // Bar representation inside revenue table
  barTrack: {
    height: 7,
    backgroundColor: "#EEF1F8",
    borderRadius: 4,
    flexDirection: "row",
  },
  barFill: { height: 7, borderRadius: 4, backgroundColor: PRIMARY },

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
  footerText: { fontSize: 7, color: MUTED },
});

function formatMYR(amount: number) {
  return `RM ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export interface ReportsPDFData {
  company: {
    name: string;
    registrationNo?: string | null;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  periodLabel: string; // "Weekly" | "Monthly" | "Yearly"
  generatedAt: string;
  totalRevenue: number;
  totalQuotes: number;
  acceptanceRate: number;
  acceptedCount: number;
  rejectedCount: number;
  draftCount: number;
  sentCount: number;
  periodData: PeriodBucket[];
  topCustomers: { name: string; total: number; count: number }[];
}

export function ReportsPDF({ data }: { data: ReportsPDFData }) {
  const maxRevenue = Math.max(1, ...data.periodData.map((d) => d.revenue));
  const statusRows = [
    { label: "Accepted", count: data.acceptedCount },
    { label: "Sent", count: data.sentCount },
    { label: "Draft", count: data.draftCount },
    { label: "Rejected", count: data.rejectedCount },
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{data.company.name}</Text>
            {data.company.registrationNo ? (
              <Text style={styles.companyMeta}>Reg. No: {data.company.registrationNo}</Text>
            ) : null}
            {data.company.address ? (
              <Text style={styles.companyMeta}>{data.company.address}</Text>
            ) : null}
            {data.company.city ? (
              <Text style={styles.companyMeta}>{data.company.city}</Text>
            ) : null}
            {data.company.phone || data.company.email ? (
              <Text style={styles.companyMeta}>
                {[data.company.phone, data.company.email].filter(Boolean).join("  •  ")}
              </Text>
            ) : null}
          </View>
          <View>
            <Text style={styles.reportLabel}>REPORTS &amp; ANALYTICS</Text>
            <Text style={styles.reportTitle}>{data.periodLabel} Overview</Text>
            <Text style={styles.reportMeta}>Generated {data.generatedAt}</Text>
          </View>
        </View>

        {/* Stat cards */}
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TOTAL REVENUE (ACCEPTED)</Text>
            <Text style={styles.statValue}>{formatMYR(data.totalRevenue)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TOTAL QUOTATIONS</Text>
            <Text style={styles.statValue}>{data.totalQuotes}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>ACCEPTANCE RATE</Text>
            <Text style={styles.statValue}>{data.acceptanceRate}%</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>REJECTED QUOTES</Text>
            <Text style={styles.statValue}>{data.rejectedCount}</Text>
          </View>
        </View>

        {/* Revenue & volume by period */}
        <Text style={styles.sectionTitle}>{data.periodLabel} Revenue & Quote Volume</Text>
        <View>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { flex: 1.4 }]}>Period</Text>
            <Text style={[styles.tableHeaderText, { flex: 3 }]}>Revenue (Accepted)</Text>
            <Text style={[styles.tableHeaderText, { flex: 1.6, textAlign: "right" }]}>Amount</Text>
            <Text style={[styles.tableHeaderText, { flex: 0.8, textAlign: "right" }]}>Quotes</Text>
          </View>
          {data.periodData.map((row, idx) => (
            <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
              <Text style={[styles.cell, { flex: 1.4 }]}>{row.label}</Text>
              <View style={{ flex: 3, paddingRight: 10 }}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.round((row.revenue / maxRevenue) * 100)}%`,
                        backgroundColor: idx === data.periodData.length - 1 ? ACCENT : PRIMARY,
                      },
                    ]}
                  />
                </View>
              </View>
              <Text style={[styles.cell, { flex: 1.6, textAlign: "right" }]}>
                {formatMYR(row.revenue)}
              </Text>
              <Text style={[styles.cell, { flex: 0.8, textAlign: "right" }]}>{row.quotes}</Text>
            </View>
          ))}
        </View>

        {/* Status breakdown */}
        <Text style={styles.sectionTitle}>Quote Status Breakdown</Text>
        <View>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { flex: 3 }]}>Status</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "right" }]}>Count</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "right" }]}>Share</Text>
          </View>
          {statusRows.map((row, idx) => (
            <View key={row.label} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
              <Text style={[styles.cell, { flex: 3 }]}>{row.label}</Text>
              <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>{row.count}</Text>
              <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>
                {data.totalQuotes > 0 ? Math.round((row.count / data.totalQuotes) * 100) : 0}%
              </Text>
            </View>
          ))}
        </View>

        {/* Top customers */}
        <Text style={styles.sectionTitle}>Top Customers by Revenue</Text>
        <View>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { flex: 0.5 }]}>#</Text>
            <Text style={[styles.tableHeaderText, { flex: 4 }]}>Customer</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "right" }]}>Quotes</Text>
            <Text style={[styles.tableHeaderText, { flex: 2, textAlign: "right" }]}>Revenue</Text>
          </View>
          {data.topCustomers.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={[styles.cell, { color: MUTED }]}>No data yet.</Text>
            </View>
          ) : (
            data.topCustomers.map((c, idx) => (
              <View key={c.name + idx} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.cell, { flex: 0.5 }]}>{idx + 1}</Text>
                <Text style={[styles.cell, { flex: 4 }]}>{c.name}</Text>
                <Text style={[styles.cell, { flex: 1, textAlign: "right" }]}>{c.count}</Text>
                <Text style={[styles.cell, { flex: 2, textAlign: "right" }]}>{formatMYR(c.total)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{data.company.name} — Reports & Analytics</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
