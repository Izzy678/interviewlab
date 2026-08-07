import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import type {
  InterviewAnalysis,
  InterviewPlanData,
  ChatMessage,
  ModelAnswer,
} from "./interview";

/* ── Styles ────────────────────────────────────────────── */

const COLORS = {
  primary: "#1a365d",
  accent: "#2b6cb0",
  muted: "#718096",
  border: "#e2e8f0",
  text: "#1a202c",
  textMuted: "#a0aec0",
  emerald: "#059669",
  emeraldLight: "#ecfdf5",
  emeraldBorder: "#a7f3d0",
  amber: "#d97706",
  white: "#ffffff",
  bgLight: "#f7fafc",
};

const styles = StyleSheet.create({
  page: {
    padding: 48,
    paddingTop: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: COLORS.text,
    lineHeight: 1.5,
  },
  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 16,
    marginBottom: 28,
  },
  headerLeft: {},
  brand: {
    fontSize: 16,
    fontWeight: 700,
    color: COLORS.primary,
    letterSpacing: -0.3,
  },
  brandSub: {
    fontSize: 8,
    color: COLORS.muted,
    marginTop: 2,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  roleLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.text,
  },
  metaText: {
    fontSize: 9,
    color: COLORS.muted,
    marginTop: 2,
  },

  /* Section headers */
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: COLORS.primary,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 14,
  },

  /* Summary */
  summaryBlock: {
    backgroundColor: COLORS.bgLight,
    padding: 16,
    borderRadius: 4,
    marginBottom: 24,
  },
  summaryText: {
    fontSize: 12,
    lineHeight: 1.7,
    color: COLORS.text,
    fontStyle: "italic",
  },

  /* Score row */
  scoreRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
    flexWrap: "wrap",
  },
  scoreCard: {
    flex: 1,
    minWidth: 80,
    padding: 10,
    backgroundColor: COLORS.bgLight,
    borderRadius: 4,
    alignItems: "center",
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: 700,
    color: COLORS.accent,
  },
  scoreLabel: {
    fontSize: 8,
    color: COLORS.muted,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  /* Two-column layout */
  twoCol: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 24,
  },
  col: {
    flex: 1,
  },
  colTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: COLORS.text,
    marginBottom: 8,
  },
  colDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 5,
    marginRight: 8,
  },
  colItem: {
    flexDirection: "row",
    marginBottom: 8,
  },
  colItemText: {
    fontSize: 9,
    lineHeight: 1.6,
    color: COLORS.text,
    flex: 1,
  },

  /* Transcript */
  transcriptEntry: {
    flexDirection: "row",
    marginBottom: 8,
  },
  speakerLabel: {
    width: 72,
    fontSize: 8,
    fontWeight: 700,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingTop: 2,
  },
  transcriptText: {
    flex: 1,
    fontSize: 9,
    lineHeight: 1.6,
    color: COLORS.text,
  },

  /* Model answers */
  modelAnswerItem: {
    marginBottom: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modelAnswerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 7,
  },
  modelAnswerIndex: {
    fontSize: 10,
    fontWeight: 700,
    color: COLORS.textMuted,
    marginRight: 8,
  },
  modelAnswerCategory: {
    fontSize: 7,
    fontWeight: 700,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
  },
  modelAnswerQuestion: {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.text,
    lineHeight: 1.5,
    marginBottom: 9,
  },
  userAnswerBlock: {
    backgroundColor: COLORS.bgLight,
    padding: 10,
    borderRadius: 4,
    marginBottom: 8,
  },
  answerLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  answerText: {
    fontSize: 9,
    lineHeight: 1.6,
    color: COLORS.text,
  },
  modelAnswerBlock: {
    borderWidth: 1,
    borderColor: COLORS.emeraldBorder,
    backgroundColor: COLORS.emeraldLight,
    padding: 10,
    borderRadius: 4,
  },
  modelAnswerLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: COLORS.emerald,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },

  /* Footer */
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    fontSize: 7,
    color: COLORS.textMuted,
  },

  pageNumber: {
    position: "absolute",
    bottom: 24,
    right: 48,
    fontSize: 7,
    color: COLORS.textMuted,
  },
});

/* ── Helper ────────────────────────────────────────────── */

function formatDurationLabel(seconds?: number): string {
  if (seconds === undefined) return "N/A";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

/* ── PDF Document Component ────────────────────────────── */

interface ReportPdfProps {
  plan: InterviewPlanData;
  conversation: ChatMessage[];
  analysis: InterviewAnalysis | null;
  durationSeconds?: number;
  modelAnswers?: ModelAnswer[] | null;
}

function ReportDocument({
  plan,
  conversation,
  analysis,
  durationSeconds,
  modelAnswers,
}: ReportPdfProps) {
  const totalExchanges = Math.floor(conversation.length / 2);

  return (
    <Document>
      {/* Page 1 — Cover / Summary */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.brand}>InterviewLab</Text>
            <Text style={styles.brandSub}>Mock Interview Report</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.roleLabel}>
              {plan.target_role || "Practice Interview"}
            </Text>
            <Text style={styles.metaText}>
              {plan.target_seniority || ""}
              {plan.target_seniority && durationSeconds !== undefined
                ? " · "
                : ""}
              {durationSeconds !== undefined
                ? `Duration ${formatDurationLabel(durationSeconds)}`
                : ""}
            </Text>
          </View>
        </View>

        {/* Summary */}
        {analysis?.summary && (
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryText}>“{analysis.summary}”</Text>
          </View>
        )}

        {/* Scores */}
        {analysis && (
          <>
            <View style={styles.scoreRow}>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreValue}>{analysis.overall_score}</Text>
                <Text style={styles.scoreLabel}>Overall</Text>
              </View>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreValue}>
                  {analysis.metrics.clarity}
                </Text>
                <Text style={styles.scoreLabel}>Clarity</Text>
              </View>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreValue}>
                  {analysis.metrics.depth}
                </Text>
                <Text style={styles.scoreLabel}>Depth</Text>
              </View>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreValue}>
                  {analysis.metrics.relevance}
                </Text>
                <Text style={styles.scoreLabel}>Relevance</Text>
              </View>
              <View style={styles.scoreCard}>
                <Text style={styles.scoreValue}>
                  {analysis.metrics.communication}
                </Text>
                <Text style={styles.scoreLabel}>Communication</Text>
              </View>
            </View>

            {/* Strengths & Improvements */}
            <View style={styles.sectionDivider} />
            <View style={styles.twoCol}>
              <View style={styles.col}>
                {analysis.strengths.length > 0 && (
                  <>
                    <Text style={styles.colTitle}>
                      ✓ What came through well
                    </Text>
                    {analysis.strengths.slice(0, 3).map((s, i) => (
                      <View key={i} style={styles.colItem}>
                        <View
                          style={[
                            styles.colDot,
                            { backgroundColor: COLORS.emerald },
                          ]}
                        />
                        <Text style={styles.colItemText}>{s}</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
              <View style={styles.col}>
                {analysis.improvements.length > 0 && (
                  <>
                    <Text style={styles.colTitle}>
                      ↑ Where to focus next
                    </Text>
                    {analysis.improvements.slice(0, 3).map((s, i) => (
                      <View key={i} style={styles.colItem}>
                        <View
                          style={[
                            styles.colDot,
                            { backgroundColor: COLORS.amber },
                          ]}
                        />
                        <Text style={styles.colItemText}>{s}</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            </View>
          </>
        )}

        {/* Transcript header */}
        <View style={styles.sectionDivider} />
        <Text style={styles.sectionTitle}>Conversation Transcript</Text>
        <Text style={[styles.metaText, { marginBottom: 14 }]}>
          {totalExchanges > 0
            ? `${totalExchanges} exchange${totalExchanges === 1 ? "" : "s"}`
            : "Full conversation transcript"}
        </Text>

        {conversation.length === 0 ? (
          <Text style={[styles.colItemText, { fontStyle: "italic" }]}>
            No transcript available.
          </Text>
        ) : (
          conversation.map((msg, i) => (
            <View key={i} style={styles.transcriptEntry}>
              <Text style={styles.speakerLabel}>
                {msg.role === "assistant" ? "Interviewer" : "You"}
              </Text>
              <Text style={styles.transcriptText}>{msg.content}</Text>
            </View>
          ))
        )}

        {/* Page number */}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>

      {/* Page 2+ — How you could have answered */}
      {modelAnswers && modelAnswers.length > 0 && (
        <Page size="A4" style={styles.page} wrap>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.brand}>InterviewLab</Text>
              <Text style={styles.brandSub}>Mock Interview Report</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.roleLabel}>
                {plan.target_role || "Practice Interview"}
              </Text>
              <Text style={styles.metaText}>How you could have answered</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>
            How you could have answered
          </Text>
          <View style={styles.sectionDivider} />

          {modelAnswers.map((item, i) => (
            <View key={i} style={styles.modelAnswerItem}>
              <View style={styles.modelAnswerHeader}>
                <Text style={styles.modelAnswerIndex}>
                  {String(i + 1).padStart(2, "0")}
                </Text>
                <Text style={styles.modelAnswerCategory}>
                  {item.category.replace(/_/g, " ")}
                </Text>
              </View>

              <Text style={styles.modelAnswerQuestion}>
                “{item.question}”
              </Text>

              {item.userAnswer.trim() && (
                <View style={styles.userAnswerBlock}>
                  <Text style={styles.answerLabel}>Your answer</Text>
                  <Text style={styles.answerText}>{item.userAnswer}</Text>
                </View>
              )}

              <View style={styles.modelAnswerBlock}>
                <Text style={styles.modelAnswerLabel}>A stronger answer</Text>
                <Text style={styles.answerText}>{item.modelAnswer}</Text>
              </View>
            </View>
          ))}

          {/* Page number */}
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
            fixed
          />
        </Page>
      )}
    </Document>
  );
}

/* ── Public API ────────────────────────────────────────── */

/**
 * Generate and download a PDF report of the interview.
 * Uses @react-pdf/renderer to produce a professional A4 document.
 */
export async function downloadPdfReport(
  plan: InterviewPlanData,
  conversation: ChatMessage[],
  analysis: InterviewAnalysis | null,
  durationSeconds?: number,
  modelAnswers?: ModelAnswer[] | null,
): Promise<void> {
  const blob = await pdf(
    <ReportDocument
      plan={plan}
      conversation={conversation}
      analysis={analysis}
      durationSeconds={durationSeconds}
      modelAnswers={modelAnswers}
    />,
  ).toBlob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `interview-report-${(plan.target_role || "practice")
    .toLowerCase()
    .replace(/\s+/g, "-")}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}