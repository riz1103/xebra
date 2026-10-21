import { useMemo } from "react";
import { View } from "react-native";
import QRCode from "qrcode";

/** Draws a QR code from the same data the website encodes, without a native module. */
export function QrCode({ value, size = 112 }: { value: string; size?: number }) {
  const cells = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
    const count = qr.modules.size;
    const rows: boolean[][] = [];
    for (let y = 0; y < count; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < count; x++) row.push(qr.modules.get(y, x) === 1);
      rows.push(row);
    }
    return rows;
  }, [value]);
  const cell = size / cells.length;
  return (
    <View style={{ width: size, height: size, backgroundColor: "#ffffff" }}>
      {cells.map((row, y) => (
        <View key={y} style={{ flexDirection: "row", height: cell }}>
          {row.map((on, x) => (
            <View key={x} style={{ width: cell, height: cell, backgroundColor: on ? "#171717" : "#ffffff" }} />
          ))}
        </View>
      ))}
    </View>
  );
}
