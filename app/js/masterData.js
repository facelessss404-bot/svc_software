// SVC Smart Move - Phase 1: Canonical Master Data from Main_Data
// Exact Wire Size strings and punctuation (including dots) are preserved byte-for-byte.

const MASTER_DATA = [
  { wireSize: "3.30", wireCode: "A", grade: "IS7341975", gradeCode: "l", material: "AL", templateBatch: "AL-A-l-000", supplier: "RCW" },
  { wireSize: "5.50", wireCode: "B", grade: "IS7341975", gradeCode: "l", material: "AL", templateBatch: "AL-B-l-000", supplier: "AK" },
  { wireSize: "4.20(DA)", wireCode: "C", grade: "5056", gradeCode: "d", material: "AL", templateBatch: "AL-C-d-000", supplier: "Sensor" },
  { wireSize: "8.60", wireCode: "D", grade: "IS7341975", gradeCode: "l", material: "AL", templateBatch: "AL-D-l-000", supplier: "Precision" },
  { wireSize: "2.60", wireCode: "A", grade: "CUZN35", gradeCode: "j", material: "BR", templateBatch: "BR-A-j-000", supplier: "Sai" },
  { wireSize: "4.00", wireCode: "B", grade: "CUZN35", gradeCode: "j", material: "BR", templateBatch: "BR-B-j-000", supplier: "Venus" },
  { wireSize: "5.50.", wireCode: "C", grade: "CUZN35", gradeCode: "j", material: "BR", templateBatch: "BR-C-j-000", supplier: "Sharp" },
  { wireSize: "4.50", wireCode: "D", grade: "CUZN36", gradeCode: "k", material: "BR", templateBatch: "BR-D-k-000", supplier: "KEI" },
  { wireSize: "3.30.", wireCode: "A", grade: "CUDHP", gradeCode: "i", material: "CU", templateBatch: "CU-A-i-000", supplier: "" },
  { wireSize: "8.30", wireCode: "B", grade: "CUDHP", gradeCode: "i", material: "CU", templateBatch: "CU-B-i-000", supplier: "" },
  { wireSize: "11.10", wireCode: "C", grade: "CUDHP", gradeCode: "i", material: "CU", templateBatch: "CU-C-i-000", supplier: "" },
  { wireSize: "12.50", wireCode: "D", grade: "CUDHP", gradeCode: "i", material: "CU", templateBatch: "CU-D-i-000", supplier: "" },
  { wireSize: "2.20", wireCode: "E", grade: "CUDHP", gradeCode: "i", material: "CU", templateBatch: "CU-E-i-000", supplier: "" },
  { wireSize: "9.40(DA)", wireCode: "I", grade: "1010", gradeCode: "a", material: "MS", templateBatch: "MS-I-a-000", supplier: "" },
  { wireSize: "2.20(DA)", wireCode: "A", grade: "1010", gradeCode: "a", material: "MS", templateBatch: "MS-A-a-000", supplier: "" },
  { wireSize: "5.50(DA).", wireCode: "AA", grade: "15B25", gradeCode: "e", material: "MS", templateBatch: "MS-AA-e-000", supplier: "" },
  { wireSize: "8.78 (DA)", wireCode: "AB", grade: "1010", gradeCode: "a", material: "MS", templateBatch: "MS-AB-a-000", supplier: "" },
  { wireSize: "5.10(DA)", wireCode: "AC", grade: "1018", gradeCode: "b", material: "MS", templateBatch: "MS-AC-b-000", supplier: "" },
  { wireSize: "4.00(DA)", wireCode: "AD", grade: "1035", gradeCode: "c", material: "MS", templateBatch: "MS-AD-c-000", supplier: "" },
  { wireSize: "4.50(DA)", wireCode: "AE", grade: "1035", gradeCode: "c", material: "MS", templateBatch: "MS-AE-c-000", supplier: "" },
  { wireSize: "3.30(DA)", wireCode: "B", grade: "1010", gradeCode: "a", material: "MS", templateBatch: "MS-B-a-000", supplier: "" },
  { wireSize: "4.50(DA).", wireCode: "C", grade: "1010", gradeCode: "a", material: "MS", templateBatch: "MS-C-a-000", supplier: "" },
  { wireSize: "4.78", wireCode: "D", grade: "1010", gradeCode: "a", material: "MS", templateBatch: "MS-D-a-000", supplier: "" },
  { wireSize: "4.90", wireCode: "E", grade: "1010", gradeCode: "a", material: "MS", templateBatch: "MS-E-a-000", supplier: "" },
  { wireSize: "5.50(DA)", wireCode: "F", grade: "1010", gradeCode: "a", material: "MS", templateBatch: "MS-F-a-000", supplier: "" },
  { wireSize: "5.88", wireCode: "G", grade: "1010", gradeCode: "a", material: "MS", templateBatch: "MS-G-a-000", supplier: "" },
  { wireSize: "5.92", wireCode: "H", grade: "1010", gradeCode: "a", material: "MS", templateBatch: "MS-H-a-000", supplier: "" },
  { wireSize: "9.85", wireCode: "J", grade: "1010", gradeCode: "a", material: "MS", templateBatch: "MS-J-a-000", supplier: "" },
  { wireSize: "6.88", wireCode: "K", grade: "1010", gradeCode: "a", material: "MS", templateBatch: "MS-K-a-000", supplier: "" },
  { wireSize: "7.40(DA)", wireCode: "L", grade: "1010", gradeCode: "a", material: "MS", templateBatch: "MS-L-a-000", supplier: "" },
  { wireSize: "7.88", wireCode: "M", grade: "1010", gradeCode: "a", material: "MS", templateBatch: "MS-M-a-000", supplier: "" },
  { wireSize: "8.25(DA)", wireCode: "N", grade: "1010", gradeCode: "a", material: "MS", templateBatch: "MS-N-a-000", supplier: "" },
  { wireSize: "9.30(DA)", wireCode: "O", grade: "1010", gradeCode: "a", material: "MS", templateBatch: "MS-O-a-000", supplier: "" },
  { wireSize: "5.20(DA)", wireCode: "P", grade: "1035", gradeCode: "c", material: "MS", templateBatch: "MS-P-c-000", supplier: "" },
  { wireSize: "8.30(DA) ", wireCode: "Q", grade: "1035", gradeCode: "c", material: "MS", templateBatch: "MS-Q-c-000", supplier: "" },
  { wireSize: "9.85.", wireCode: "R", grade: "1035", gradeCode: "c", material: "MS", templateBatch: "MS-R-c-000", supplier: "" },
  { wireSize: "6.40", wireCode: "U", grade: "1010", gradeCode: "a", material: "MS", templateBatch: "MS-U-a-000", supplier: "" },
  { wireSize: "3.74", wireCode: "V", grade: "1010", gradeCode: "a", material: "MS", templateBatch: "MS-V-a-000", supplier: "" },
  { wireSize: "5.50(DA)x", wireCode: "W", grade: "IS7887", gradeCode: "m", material: "MS", templateBatch: "MS-W-m-000", supplier: "" },
  { wireSize: "2.20(DA)", wireCode: "W", grade: "S20C", gradeCode: "n", material: "MS", templateBatch: "MS-W-n-000", supplier: "" },
  { wireSize: "4.50(DA)x", wireCode: "X", grade: "S20C", gradeCode: "n", material: "MS", templateBatch: "MS-X-n-000", supplier: "" },
  { wireSize: "5.00(DA)", wireCode: "Y", grade: "S20C", gradeCode: "n", material: "MS", templateBatch: "MS-Y-n-000", supplier: "" },
  { wireSize: "7.20(DA)", wireCode: "Z", grade: "1035", gradeCode: "c", material: "MS", templateBatch: "MS-Z-c-000", supplier: "" },
  { wireSize: "2.98", wireCode: "A", grade: "AISI430", gradeCode: "h", material: "SS", templateBatch: "SS-A-h-000", supplier: "" },
  { wireSize: "3.88", wireCode: "B", grade: "AISI430", gradeCode: "h", material: "SS", templateBatch: "SS-B-h-000", supplier: "" },
  { wireSize: "3.88(304)", wireCode: "G", grade: "AISI304", gradeCode: "h", material: "SS", templateBatch: "SS-G-h-000", supplier: "" },
  { wireSize: "3.80", wireCode: "H", grade: "AISI430", gradeCode: "h", material: "SS", templateBatch: "SS-H-h-000", supplier: "" },
  { wireSize: "4.78(304)", wireCode: "L", grade: "AISI304", gradeCode: "f", material: "SS", templateBatch: "SS-L-f-000", supplier: "" },
  { wireSize: "4.78(304CU2)", wireCode: "M", grade: "AISI304CU2", gradeCode: "g", material: "SS", templateBatch: "SS-M-g-000", supplier: "" }
];

const SUPPLIERS = [
  "RCW",
  "AK",
  "Sensor",
  "Precision",
  "Sai",
  "Venus",
  "Sharp",
  "KEI"
];

if (typeof window !== 'undefined') {
  window.MASTER_DATA = MASTER_DATA;
  window.SUPPLIERS = SUPPLIERS;
}
