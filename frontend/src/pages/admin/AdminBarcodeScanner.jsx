import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/useAuth';

import {
  addRawRecoveryRow,
  completeRawRecoveryRow,
  createRawRecoverySheet,
  listRawRecoveryLines,
  listRawRecoveryVendors,
  lookupRawRecoverySheet,
  removeRawRecoveryRow,
  getRawRecoveryResetStatus,
  resetRawRecoverySheet,
  saveRawRecoverySheet,
  editRawRecoverySheet,
  reopenRawRecoveryRow,
  removeRawRecoveryBarcode,
  scanRawRecoveryBarcode,
} from '../../services/rawRecoveryService';

const BARCODE_RE = /^.+-(4|5|6|8)$/;

const statusClasses = {
  'Not Started': 'bg-slate-100 text-slate-600',
  'In Progress': 'bg-orange-100 text-orange-700',
  Completed: 'bg-emerald-100 text-emerald-700',
};

export default function AdminBarcodeScanner() {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const detectorRef = useRef(null);
  const scanningRef = useRef(false);
  const scanBusyRef = useRef(false);
  const lastDetectedRef = useRef({ value: '', at: 0 });

  const [setup, setSetup] = useState({
    packagingDate: '',
    vendorName: '',
    lineNumber: '',
  });
  const [vendors, setVendors] = useState([]);
  const [availableLines, setAvailableLines] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [selectedRowNumber, setSelectedRowNumber] = useState(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [loadingLines, setLoadingLines] = useState(false);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraMessage, setCameraMessage] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [rowActionBusy, setRowActionBusy] = useState(false);
  const [savingSheet, setSavingSheet] = useState(false);
  const [editingSheet, setEditingSheet] = useState(false);
  const [resettingSheet, setResettingSheet] = useState(false);
  const [showRecoveryResetWarning, setShowRecoveryResetWarning] = useState(false);
  const [recoverySheetId, setRecoverySheetId] = useState('');

  const selectedRow = useMemo(
    () =>
      sheet?.rows?.find(
        (row) => row.rowNumber === selectedRowNumber
      ) || null,
    [sheet, selectedRowNumber]
  );

  const sortedRows = useMemo(
    () =>
      [...(sheet?.rows || [])].sort(
        (left, right) => left.rowNumber - right.rowNumber
      ),
    [sheet]
  );

  const allRowsCompleted =
    sortedRows.length > 0 &&
    sortedRows.every((row) => row.status === 'Completed');

  const sheetSaved = Boolean(sheet?.savedAt);
  const canEditSavedSheet = ['admin', 'subadmin'].includes(user.role);
  const canDownloadCompletedSheet = ['admin', 'subadmin'].includes(user.role);
  const canViewRecoverySheet = ['admin', 'subadmin', 'vendor'].includes(user.role);
  const roleBasePath = {
    admin: '/admin',
    subadmin: '/sub-admin',
    vendor: '/vendor',
    supervisor: '/supervisor',
  }[user.role];
  const recoverySheetPath = roleBasePath
    ? `${roleBasePath}/recovery-sheets`
    : '/';
  const portalLabel = {
    admin: 'Admin',
    subadmin: 'Sub-Admin',
    vendor: 'Vendor',
    supervisor: 'Supervisor',
  }[user.role] || 'Portal';

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    stopCamera();
    setSheet(null);
    setSelectedRowNumber(null);
    setAvailableLines([]);
    setSetup((current) => ({
      ...current,
      vendorName: '',
      lineNumber: '',
    }));
    setVendors([]);
    setError('');
    setMessage('');

    if (!setup.packagingDate) {
      return;
    }

    let active = true;
    setLoadingVendors(true);

    listRawRecoveryVendors(setup.packagingDate)
      .then((result) => {
        if (active) {
          setVendors(result.vendors || []);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(normalizeError(requestError, 'Unable to load vendors'));
        }
      })
      .finally(() => {
        if (active) {
          setLoadingVendors(false);
        }
      });

    return () => {
      active = false;
    };
  }, [setup.packagingDate]);

  useEffect(() => {
    stopCamera();
    setSheet(null);
    setSelectedRowNumber(null);
    setAvailableLines([]);
    setSetup((current) => ({
      ...current,
      lineNumber: '',
    }));
    setError('');
    setMessage('');

    if (!setup.packagingDate || !setup.vendorName) {
      return;
    }

    let active = true;
    setLoadingLines(true);

    listRawRecoveryLines({
      packagingDate: setup.packagingDate,
      vendorName: setup.vendorName,
    })
      .then((result) => {
        if (active) {
          setAvailableLines(result.lines || []);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(normalizeError(requestError, 'Unable to load line data'));
        }
      })
      .finally(() => {
        if (active) {
          setLoadingLines(false);
        }
      });

    return () => {
      active = false;
    };
  }, [setup.packagingDate, setup.vendorName]);

  const updateSheetRow = (row) => {
    setSheet((current) => {
      if (!current) return current;

      return {
        ...current,
        rows: current.rows.map((item) =>
          item.rowNumber === row.rowNumber ? row : item
        ),
      };
    });
  };

  const stopCamera = () => {
    scanningRef.current = false;
    scanBusyRef.current = false;

    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
  };

  const loadOrCreateSheet = async (event) => {
    event.preventDefault();
    stopCamera();
    setError('');
    setMessage('');

    const lineNumber = Number(setup.lineNumber);

    if (!setup.packagingDate) {
      setError('Select a Packaging Date.');
      return;
    }

    if (!setup.vendorName) {
      setError('Select a Vendor Name.');
      return;
    }

    if (!Number.isInteger(lineNumber) || lineNumber < 1) {
      setError('Line Number must be a positive whole number.');
      return;
    }

    if (
      availableLines.length > 0 &&
      !availableLines.includes(lineNumber)
    ) {
      setError(
        `Line ${lineNumber} is not available for ${setup.vendorName} on ${setup.packagingDate}.`
      );
      return;
    }

    setLoadingSheet(true);

    const payload = {
      packagingDate: setup.packagingDate,
      vendorName: setup.vendorName,
      lineNumber,
    };

    try {
      let result;

      try {
        result = await lookupRawRecoverySheet(payload);
        setMessage('Existing Raw Recovery Sheet loaded.');
      } catch (lookupError) {
        if (lookupError.response?.status !== 404) {
          throw lookupError;
        }

        result = await createRawRecoverySheet(payload);
        setMessage('New Raw Recovery Sheet created with 11 rows.');
      }

      const loadedSheet = result.data;
      setSheet(loadedSheet);
      setRecoverySheetId('');

      if (loadedSheet.savedAt) {
        setMessage(
          'This Raw Recovery Sheet is already saved and locked. Its Recovery Sheet is available in Recovery Sheet.'
        );
      }

      const firstOpenRow = [...(loadedSheet.rows || [])]
        .sort((a, b) => a.rowNumber - b.rowNumber)
        .find((row) => row.status !== 'Completed');

      setSelectedRowNumber(
        firstOpenRow?.rowNumber || loadedSheet.rows?.[0]?.rowNumber || null
      );
    } catch (requestError) {
      setError(
        normalizeError(
          requestError,
          'Unable to load or create the Raw Recovery Sheet'
        )
      );
    } finally {
      setLoadingSheet(false);
    }
  };

  const submitBarcode = async (rawValue, source = 'manual') => {
    const barcodeId = String(rawValue || '').trim();

    if (!sheet || !selectedRow) {
      setError('Load a sheet and select a row before scanning.');
      return false;
    }

    if (sheet.savedAt) {
      setError('This Raw Recovery Sheet is already saved and cannot be changed.');
      return false;
    }

    if (selectedRow.status === 'Completed') {
      setError(`Row ${selectedRow.rowNumber} is already Completed.`);
      return false;
    }

    if (!BARCODE_RE.test(barcodeId)) {
      setError('Barcode must end with -4, -5, -6, or -8.');
      return false;
    }

    setError('');
    setMessage('');

    try {
      const result = await scanRawRecoveryBarcode({
        sheetId: sheet._id,
        rowNumber: selectedRow.rowNumber,
        barcodeId,
      });

      updateSheetRow(result.data.row);
      setMessage(
        `${barcodeId} scanned into Row ${selectedRow.rowNumber}.`
      );

      if (source === 'manual') {
        setManualBarcode('');
      }

      if (navigator.vibrate) {
        navigator.vibrate(80);
      }

      return true;
    } catch (requestError) {
      setError(normalizeError(requestError, 'Unable to save barcode'));
      return false;
    }
  };

  const handleManualSubmit = async (event) => {
    event.preventDefault();

    if (scanBusyRef.current) return;
    scanBusyRef.current = true;

    try {
      await submitBarcode(manualBarcode, 'manual');
    } finally {
      scanBusyRef.current = false;
    }
  };

  const scanFrame = async () => {
    if (
      !scanningRef.current ||
      !videoRef.current ||
      !detectorRef.current
    ) {
      return;
    }

    try {
      if (
        videoRef.current.readyState >= 2 &&
        !scanBusyRef.current
      ) {
        const codes = await detectorRef.current.detect(videoRef.current);

        if (codes.length > 0) {
          const value = String(codes[0].rawValue || '').trim();
          const now = Date.now();
          const last = lastDetectedRef.current;

          if (
            value &&
            (value !== last.value || now - last.at > 1800)
          ) {
            lastDetectedRef.current = { value, at: now };
            scanBusyRef.current = true;

            try {
              await submitBarcode(value, 'camera');
            } finally {
              scanBusyRef.current = false;
            }
          }
        }
      }
    } catch {
      // Keep scanning after transient native BarcodeDetector errors.
    }

    if (scanningRef.current) {
      frameRef.current = window.requestAnimationFrame(scanFrame);
    }
  };

  const startCamera = async () => {
    setError('');
    setMessage('');
    setCameraMessage('');

    if (!selectedRow) {
      setCameraMessage('Select a row before starting the scanner.');
      return;
    }

    if (sheet?.savedAt) {
      setCameraMessage('This Raw Recovery Sheet is saved and locked.');
      return;
    }

    if (selectedRow.status === 'Completed') {
      setCameraMessage(
        `Row ${selectedRow.rowNumber} is Completed. Select another row.`
      );
      return;
    }

    if (!window.isSecureContext) {
      setCameraMessage(
        'Camera scanning requires HTTPS (or localhost). Use the manual/scanner input below when testing over a normal LAN HTTP address.'
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage(
        'Camera access is not available in this browser. Use the manual/scanner input below.'
      );
      return;
    }

    if (!('BarcodeDetector' in window)) {
      setCameraMessage(
        'This browser does not support native barcode detection. Use Chrome/Edge on a supported device or the manual/scanner input below.'
      );
      return;
    }

    try {
      stopCamera();

      const supportedFormats =
        await window.BarcodeDetector.getSupportedFormats?.();

      if (
        Array.isArray(supportedFormats) &&
        !supportedFormats.includes('code_128')
      ) {
        setCameraMessage(
          'Code 128 barcode detection is not supported by this browser. Use the manual/scanner input below.'
        );
        return;
      }

      detectorRef.current = new window.BarcodeDetector({
        formats: ['code_128'],
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      scanningRef.current = true;
      setCameraActive(true);
      setCameraMessage(
        `Scanning barcodes into Row ${selectedRow.rowNumber}.`
      );
      frameRef.current = window.requestAnimationFrame(scanFrame);
    } catch (cameraError) {
      stopCamera();
      setCameraMessage(
        cameraError?.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access or use the manual/scanner input.'
          : 'Unable to start the camera. Use the manual/scanner input below.'
      );
    }
  };

  const selectRow = (rowNumber) => {
    stopCamera();
    setSelectedRowNumber(rowNumber);
    setManualBarcode('');
    setError('');
    setMessage('');
    setCameraMessage('');
    setRecoverySheetId('');
  };

  const markComplete = async () => {
    if (!sheet || !selectedRow) return;

    stopCamera();
    setRowActionBusy(true);
    setError('');
    setMessage('');

    try {
      const result = await completeRawRecoveryRow({
        sheetId: sheet._id,
        rowNumber: selectedRow.rowNumber,
      });

      updateSheetRow(result.data.row);
      setMessage(`Row ${selectedRow.rowNumber} marked as Completed.`);

      if (result.data.allRowsCompleted) {
        setMessage('All available rows are Completed.');
      }
    } catch (requestError) {
      setError(normalizeError(requestError, 'Unable to complete row'));
    } finally {
      setRowActionBusy(false);
    }
  };

  const addRow = async () => {
    if (!sheet) return;

    if (sheet.savedAt) {
      setError('Saved Raw Recovery Sheets cannot be changed.');
      return;
    }

    stopCamera();
    setRowActionBusy(true);
    setError('');
    setMessage('');

    try {
      const result = await addRawRecoveryRow(sheet._id);
      setSheet(result.data.sheet);
      setSelectedRowNumber(result.data.addedRowNumber);
      setMessage(`Row ${result.data.addedRowNumber} added.`);
    } catch (requestError) {
      setError(normalizeError(requestError, 'Unable to add row'));
    } finally {
      setRowActionBusy(false);
    }
  };

  const removeRow = async (rowNumber) => {
    if (!sheet) return;

    if (sheet.savedAt) {
      setError('Saved Raw Recovery Sheets cannot be changed.');
      return;
    }

    const row = sheet.rows.find((item) => item.rowNumber === rowNumber);

    if (!row || row.status !== 'Not Started' || row.barcodes.length > 0) {
      setError('Only a Not Started row with no scanned barcodes can be removed.');
      return;
    }

    stopCamera();
    setRowActionBusy(true);
    setError('');
    setMessage('');

    try {
      const result = await removeRawRecoveryRow({
        sheetId: sheet._id,
        rowNumber,
      });

      const updatedSheet = result.data.sheet;
      setSheet(updatedSheet);

      if (selectedRowNumber === rowNumber) {
        const nextRow = [...updatedSheet.rows].sort(
          (a, b) => a.rowNumber - b.rowNumber
        )[0];
        setSelectedRowNumber(nextRow?.rowNumber || null);
      }

      setMessage(`Row ${rowNumber} removed.`);
    } catch (requestError) {
      setError(normalizeError(requestError, 'Unable to remove row'));
    } finally {
      setRowActionBusy(false);
    }
  };

  const saveCompletedRecovery = async () => {
    if (!sheet) return;

    if (!allRowsCompleted) {
      const incompleteRows = sortedRows
        .filter((row) => row.status !== 'Completed')
        .map((row) => row.rowNumber);

      setError(
        `Complete every row before saving. Incomplete rows: ${incompleteRows.join(', ')}`
      );
      return;
    }

    stopCamera();
    setSavingSheet(true);
    setError('');
    setMessage('');

    try {
      const result = await saveRawRecoverySheet(sheet._id);
      setSheet(result.data.sheet);
      setRecoverySheetId(
        result.data.recoverySheet?._id || ''
      );
      setMessage(
        'Raw Recovery Sheet saved successfully. The Recovery Sheet has been generated and is ready to view.'
      );
    } catch (requestError) {
      setError(
        normalizeError(
          requestError,
          'Unable to save the completed Raw Recovery Sheet'
        )
      );
    } finally {
      setSavingSheet(false);
    }
  };

  const downloadCompletedSheet = () => {
    if (!sheet || !allRowsCompleted || !canDownloadCompletedSheet) {
      return;
    }

    const rows = [...(sheet.rows || [])].sort(
      (left, right) => left.rowNumber - right.rowNumber
    );

    const csvRows = [
      ['Raw Recovery Sheet - Completed Barcode Data'],
      ['Packaging Date', sheet.packagingDate || setup.packagingDate || ''],
      ['Vendor Name', sheet.vendorName || setup.vendorName || ''],
      ['Line Number', sheet.lineNumber || setup.lineNumber || ''],
      ['Status', sheet.savedAt ? 'Saved' : 'All Rows Completed'],
      ['Saved At', sheet.savedAt ? formatDateTime(sheet.savedAt) : 'Not saved yet'],
      [],
      [
        'Row',
        'Row Status',
        '4-Hand Qty',
        '5-Hand Qty',
        '6-Hand Qty',
        '8-Hand Qty',
        'Total Barcodes',
        'Started At',
        'Completed At',
      ],
      ...rows.map((row) => {
        const counts = row.barcodes.reduce(
          (accumulator, barcode) => {
            accumulator[barcode.handNumber] =
              (accumulator[barcode.handNumber] || 0) + 1;
            return accumulator;
          },
          { 4: 0, 5: 0, 6: 0, 8: 0 }
        );

        return [
          `Row ${row.rowNumber}`,
          row.status,
          counts[4],
          counts[5],
          counts[6],
          counts[8],
          row.barcodes.length,
          formatDateTime(row.startedAt),
          formatDateTime(row.completedAt),
        ];
      }),
      [],
      [
        'Row',
        'Barcode ID',
        'Hand',
        'Category',
        'Scanned At',
      ],
      ...rows.flatMap((row) =>
        row.barcodes.map((barcode) => [
          `Row ${row.rowNumber}`,
          barcode.barcodeId,
          barcode.handNumber,
          barcode.category,
          formatDateTime(barcode.scannedAt),
        ])
      ),
    ];

    const escapeCsvValue = (value) => {
      const stringValue = String(value ?? '');

      if (
        stringValue.includes(',') ||
        stringValue.includes('"') ||
        stringValue.includes('\n')
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    };

    const csv = csvRows
      .map((row) => row.map(escapeCsvValue).join(','))
      .join('\r\n');

    const blob = new Blob(['\uFEFF', csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const safeVendor = String(
      sheet.vendorName || setup.vendorName || 'vendor'
    )
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '-');

    anchor.href = url;
    anchor.download =
      `raw-recovery-${sheet.packagingDate || setup.packagingDate}` +
      `-${safeVendor}-line-${sheet.lineNumber || setup.lineNumber}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const editSavedRecovery = async () => {
    if (!sheet?.savedAt || !canEditSavedSheet) return;

    const confirmed = window.confirm(
      'Edit this saved Raw Recovery Sheet? The currently generated Recovery Sheet will be removed until you complete and Save the edited data again.'
    );

    if (!confirmed) return;

    stopCamera();
    setEditingSheet(true);
    setError('');
    setMessage('');

    try {
      const result = await editRawRecoverySheet(sheet._id);

      setSheet(result.data.sheet);
      setRecoverySheetId('');
      setMessage(
        'Edit mode enabled. Select a completed row and click Edit Row before changing its barcodes. Save again after all rows are Complete.'
      );
    } catch (requestError) {
      setError(
        normalizeError(
          requestError,
          'Unable to unlock the Raw Recovery Sheet for editing'
        )
      );
    } finally {
      setEditingSheet(false);
    }
  };

  const reopenSelectedRow = async () => {
    if (!sheet || !selectedRow || sheet.savedAt) return;

    stopCamera();
    setRowActionBusy(true);
    setError('');
    setMessage('');

    try {
      const result = await reopenRawRecoveryRow({
        sheetId: sheet._id,
        rowNumber: selectedRow.rowNumber,
      });

      updateSheetRow(result.data.row);
      setMessage(
        `Row ${selectedRow.rowNumber} is now open for editing. You can add or remove barcodes, then mark it Complete again.`
      );
    } catch (requestError) {
      setError(normalizeError(requestError, 'Unable to reopen row'));
    } finally {
      setRowActionBusy(false);
    }
  };

  const removeScannedBarcode = async (barcodeId) => {
    if (!sheet || !selectedRow) return;

    if (sheet.savedAt) {
      setError('Click Edit before changing a saved Raw Recovery Sheet.');
      return;
    }

    if (selectedRow.status === 'Completed') {
      setError(`Click Edit Row before changing Row ${selectedRow.rowNumber}.`);
      return;
    }

    setRowActionBusy(true);
    setError('');
    setMessage('');

    try {
      const result = await removeRawRecoveryBarcode({
        sheetId: sheet._id,
        rowNumber: selectedRow.rowNumber,
        barcodeId,
      });

      updateSheetRow(result.data.row);
      setMessage(`${barcodeId} removed from Row ${selectedRow.rowNumber}.`);
    } catch (requestError) {
      setError(normalizeError(requestError, 'Unable to remove barcode'));
    } finally {
      setRowActionBusy(false);
    }
  };

  const applyResetResult = (result) => {
    const resetSheet = result.data.sheet;
    const firstRow = [...(resetSheet.rows || [])].sort(
      (left, right) => left.rowNumber - right.rowNumber
    )[0];

    setSheet(resetSheet);
    setSelectedRowNumber(firstRow?.rowNumber || null);
    setManualBarcode('');
    setRecoverySheetId('');
    setShowRecoveryResetWarning(false);
    setMessage(
      result.data.recoveryDeleted
        ? 'Recovery Sheet deleted and Raw Recovery Sheet reset. All scanned barcode data was cleared.'
        : 'Raw Recovery Sheet reset. All scanned barcode data was cleared.'
    );
  };

  const performRawRecoveryReset = async (deleteGeneratedRecovery = false) => {
    if (!sheet || resettingSheet || user.role !== 'admin') return;

    stopCamera();
    setResettingSheet(true);
    setError('');
    setMessage('');
    setCameraMessage('');

    try {
      const result = await resetRawRecoverySheet(sheet._id, {
        deleteGeneratedRecovery,
      });
      applyResetResult(result);
    } catch (requestError) {
      const status = requestError.response?.status;
      const serverMessage = requestError.response?.data?.message || '';

      if (
        !deleteGeneratedRecovery &&
        status === 409 &&
        serverMessage.toLowerCase().includes('recovery sheet already exists')
      ) {
        setShowRecoveryResetWarning(true);
        return;
      }

      setError(normalizeError(requestError, 'Unable to reset the Raw Recovery Sheet'));
    } finally {
      setResettingSheet(false);
    }
  };

  const resetRawRecoveryData = async () => {
    if (!sheet || resettingSheet || user.role !== 'admin') return;

    setResettingSheet(true);
    setError('');
    setMessage('');

    try {
      const statusResult = await getRawRecoveryResetStatus(sheet._id);
      if (statusResult.data.hasGeneratedRecoverySheet) {
        setShowRecoveryResetWarning(true);
        return;
      }

      const confirmed = window.confirm(
        `Reset this Raw Recovery Sheet?\n\n${sheet.packagingDate} / ${sheet.vendorName} / Line ${sheet.lineNumber}\n\nScanned barcode data will be permanently cleared. Packaging Date, Vendor, Line Number, and the current rows will be kept.`
      );

      if (confirmed) {
        setResettingSheet(false);
        await performRawRecoveryReset(false);
      }
    } catch (requestError) {
      setError(normalizeError(requestError, 'Unable to check the Raw Recovery Sheet'));
    } finally {
      setResettingSheet(false);
    }
  };

  const resetSetup = () => {
    stopCamera();
    setSheet(null);
    setSelectedRowNumber(null);
    setManualBarcode('');
    setError('');
    setMessage('');
    setCameraMessage('');
  };

  return (
    <section className="w-full min-w-0 space-y-4 pb-8 sm:space-y-5">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-orange-600 sm:text-sm">
          {portalLabel} Barcode Scanner
        </p>

        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Scan Recovery Barcodes
        </h2>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Select the Packaging Date, Vendor and Line, choose a row, then scan
          Code 128 barcodes into the existing Raw Recovery Sheet structure.
        </p>
      </div>

      <SetupCard
        setup={setup}
        setSetup={setSetup}
        vendors={vendors}
        availableLines={availableLines}
        loadingVendors={loadingVendors}
        loadingLines={loadingLines}
        loadingSheet={loadingSheet}
        sheet={sheet}
        onSubmit={loadOrCreateSheet}
        onReset={resetSetup}
        onResetData={resetRawRecoveryData}
        resettingSheet={resettingSheet}
        canResetData={user.role === 'admin' && Boolean(sheet)}
      />

      {showRecoveryResetWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="recovery-reset-warning-title"
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <h3
              id="recovery-reset-warning-title"
              className="text-xl font-extrabold text-slate-900"
            >
              Recovery Sheet Already Exists
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              A generated Recovery Sheet already exists for this Packaging Date,
              Vendor, and Line Number.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              To reset the Raw Recovery Sheet, the existing generated Recovery
              Sheet must first be deleted. Deleting it and resetting will
              permanently clear the scanned barcode data.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowRecoveryResetWarning(false)}
                disabled={resettingSheet}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => performRawRecoveryReset(true)}
                disabled={resettingSheet}
                className="min-h-11 rounded-lg bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {resettingSheet ? 'Deleting & Resetting...' : 'Delete Recovery Sheet & Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {sheet && (
        <>
          <RowsPanel
            rows={sortedRows}
            selectedRowNumber={selectedRowNumber}
            onSelect={selectRow}
            onAdd={addRow}
            onRemove={removeRow}
            busy={rowActionBusy}
            locked={sheetSaved}
          />

          {selectedRow && (
            <div className="grid min-w-0 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <ScannerPanel
                row={selectedRow}
                cameraActive={cameraActive}
                cameraMessage={cameraMessage}
                videoRef={videoRef}
                manualBarcode={manualBarcode}
                setManualBarcode={setManualBarcode}
                onStartCamera={startCamera}
                onStopCamera={stopCamera}
                onManualSubmit={handleManualSubmit}
                onComplete={markComplete}
                onReopen={reopenSelectedRow}
                busy={rowActionBusy}
                locked={sheetSaved}
              />

              <ScannedBarcodeTable
                row={selectedRow}
                canEdit={!sheetSaved && selectedRow.status !== 'Completed'}
                busy={rowActionBusy}
                onRemoveBarcode={removeScannedBarcode}
              />
            </div>
          )}

          <FinalSavePanel
            rows={sortedRows}
            allRowsCompleted={allRowsCompleted}
            savedAt={sheet.savedAt}
            saving={savingSheet}
            recoverySheetId={recoverySheetId}
            onSave={saveCompletedRecovery}
            onEdit={editSavedRecovery}
            editing={editingSheet}
            canEditSavedSheet={canEditSavedSheet}
            canViewRecoverySheet={canViewRecoverySheet}
            canDownloadCompletedSheet={canDownloadCompletedSheet}
            onDownload={downloadCompletedSheet}
            recoverySheetPath={recoverySheetPath}
          />
        </>
      )}
    </section>
  );
}

function SetupCard({
  setup,
  setSetup,
  vendors,
  availableLines,
  loadingVendors,
  loadingLines,
  loadingSheet,
  sheet,
  onSubmit,
  onReset,
  onResetData,
  resettingSheet,
  canResetData,
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:rounded-2xl sm:p-5">
      <div className="mb-4">
        <h3 className="font-extrabold text-slate-900">Scanner Setup</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          These details determine where scanned barcodes are stored.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_0.8fr_auto] xl:items-end"
      >
        <Field label="Packaging Date">
          <input
            type="date"
            value={setup.packagingDate}
            disabled={Boolean(sheet)}
            onChange={(event) =>
              setSetup((current) => ({
                ...current,
                packagingDate: event.target.value,
              }))
            }
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100"
          />
        </Field>

        <Field label="Vendor Name">
          <select
            value={setup.vendorName}
            disabled={!setup.packagingDate || loadingVendors || Boolean(sheet)}
            onChange={(event) =>
              setSetup((current) => ({
                ...current,
                vendorName: event.target.value,
              }))
            }
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100"
          >
            <option value="">
              {loadingVendors ? 'Loading vendors...' : 'Select vendor'}
            </option>
            {vendors.map((vendor) => (
              <option key={vendor} value={vendor}>
                {vendor}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Line Number">
          <input
            type="number"
            min="1"
            step="1"
            value={setup.lineNumber}
            disabled={!setup.vendorName || loadingLines || Boolean(sheet)}
            onChange={(event) =>
              setSetup((current) => ({
                ...current,
                lineNumber: event.target.value,
              }))
            }
            placeholder={
              availableLines.length > 0
                ? `Available: ${availableLines.join(', ')}`
                : 'Enter line number'
            }
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100"
          />
        </Field>

        <div className="grid grid-cols-2 gap-2 sm:col-span-2 xl:col-span-1 xl:flex">
          {!sheet ? (
            <button
              type="submit"
              disabled={loadingSheet}
              className="min-h-11 rounded-lg bg-orange-500 px-4 text-xs font-bold text-white transition hover:bg-orange-600 disabled:opacity-50 sm:text-sm"
            >
              {loadingSheet ? 'Loading...' : 'Continue'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onReset}
                disabled={resettingSheet}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              >
                Change Setup
              </button>

              {canResetData && (
                <button
                  type="button"
                  onClick={onResetData}
                  disabled={resettingSheet}
                  className="min-h-11 rounded-lg border border-red-200 bg-white px-4 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                >
                  {resettingSheet ? 'Resetting...' : 'Reset Sheet'}
                </button>
              )}
            </>
          )}
        </div>
      </form>

      {setup.vendorName && availableLines.length > 0 && !sheet && (
        <p className="mt-3 text-xs text-slate-500">
          Available lines: <strong>{availableLines.join(', ')}</strong>
        </p>
      )}
    </section>
  );
}

function RowsPanel({
  rows,
  selectedRowNumber,
  onSelect,
  onAdd,
  onRemove,
  busy,
  locked,
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:rounded-2xl sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-slate-900">Rows</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            11 rows are created by default. Select the row you want to scan.
          </p>
        </div>

        <button
          type="button"
          onClick={onAdd}
          disabled={busy || locked}
          className="min-h-9 rounded-lg border border-orange-200 bg-orange-50 px-3 text-xs font-bold text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add Row
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 min-[390px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
        {rows.map((row) => {
          const active = row.rowNumber === selectedRowNumber;
          const removable =
            row.status === 'Not Started' &&
            row.barcodes.length === 0 &&
            rows.length > 1 &&
            !locked;

          return (
            <div
              key={row.rowNumber}
              className={`min-w-0 rounded-lg border p-2 transition ${
                active
                  ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-100'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(row.rowNumber)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between gap-1">
                  <strong className="text-xs text-slate-900 sm:text-sm">
                    Row {row.rowNumber}
                  </strong>
                  <span className="text-[10px] font-bold text-slate-500">
                    {row.barcodes.length}
                  </span>
                </div>

                <span
                  className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${
                    statusClasses[row.status] || statusClasses['Not Started']
                  }`}
                >
                  {row.status}
                </span>
              </button>

              {removable && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRemove(row.rowNumber)}
                  className="mt-2 w-full rounded-md border border-red-100 py-1 text-[9px] font-bold text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ScannerPanel({
  row,
  cameraActive,
  cameraMessage,
  videoRef,
  manualBarcode,
  setManualBarcode,
  onStartCamera,
  onStopCamera,
  onManualSubmit,
  onComplete,
  onReopen,
  busy,
  locked,
}) {
  const completed = row.status === 'Completed';
  const disabled = completed || locked;

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:rounded-2xl sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-orange-600">
            Selected Row
          </p>
          <h3 className="text-xl font-extrabold text-slate-900">
            Row {row.rowNumber}
          </h3>
        </div>

        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
            statusClasses[row.status] || statusClasses['Not Started']
          }`}
        >
          {row.status}
        </span>
      </div>

      <div className="relative mt-4 aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
        <video
          ref={videoRef}
          muted
          playsInline
          className="h-full w-full object-cover"
        />

        {!cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center text-white/70">
            <BarcodeIcon />
            <p className="mt-3 text-xs sm:text-sm">
              {locked
                ? 'This Raw Recovery Sheet is saved and locked.'
                : completed
                  ? 'This row is Completed.'
                  : 'Start the camera to scan Code 128 barcodes.'}
            </p>
          </div>
        )}

        {cameraActive && (
          <div className="pointer-events-none absolute left-[8%] right-[8%] top-1/2 h-[42%] -translate-y-1/2 rounded-xl border-2 border-orange-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.20)]" />
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {!cameraActive ? (
          <button
            type="button"
            onClick={onStartCamera}
            disabled={disabled || busy}
            className="min-h-11 rounded-lg bg-orange-500 px-3 text-xs font-bold text-white transition hover:bg-orange-600 disabled:opacity-50 sm:text-sm"
          >
            Start Scanner
          </button>
        ) : (
          <button
            type="button"
            onClick={onStopCamera}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 sm:text-sm"
          >
            Stop Scanner
          </button>
        )}

        <button
          type="button"
          onClick={completed && !locked ? onReopen : onComplete}
          disabled={locked || busy}
          className={`min-h-11 rounded-lg border px-3 text-xs font-bold transition disabled:opacity-50 sm:text-sm ${
            completed && !locked
              ? 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          {locked
            ? 'Saved'
            : completed
              ? 'Edit Row'
              : 'Mark Complete'}
        </button>
      </div>

      {cameraMessage && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
          {cameraMessage}
        </p>
      )}

      <div className="my-4 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
          Scanner / Manual Input
        </span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={onManualSubmit} className="flex min-w-0 gap-2">
        <input
          value={manualBarcode}
          disabled={disabled}
          autoComplete="off"
          onChange={(event) => setManualBarcode(event.target.value)}
          placeholder="Scan or enter barcode ID"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100"
        />
        <button
          type="submit"
          disabled={disabled || !manualBarcode.trim()}
          className="min-h-11 shrink-0 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 sm:px-4 sm:text-sm"
        >
          Add
        </button>
      </form>
    </section>
  );
}

function FinalSavePanel({
  rows,
  allRowsCompleted,
  savedAt,
  saving,
  recoverySheetId,
  onSave,
  onEdit,
  editing,
  canEditSavedSheet,
  canViewRecoverySheet,
  canDownloadCompletedSheet,
  onDownload,
  recoverySheetPath,
}) {
  const completedCount = rows.filter(
    (row) => row.status === 'Completed'
  ).length;

  if (savedAt) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 shadow-sm sm:rounded-2xl sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-emerald-700">
              Saved
            </p>
            <h3 className="mt-1 text-lg font-extrabold text-slate-900">
              Raw Recovery Sheet Finalized
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">
              All {rows.length} rows are locked and the Recovery Sheet has been generated.
              {canEditSavedSheet
                ? ' Use Edit if you need to correct the source barcode data. Save again to regenerate the Recovery Sheet.'
                : ' This saved sheet is locked and cannot be edited from your portal.'}
            </p>
            <p className="mt-1 text-[10px] text-slate-500 sm:text-xs">
              Saved: {formatDateTime(savedAt)}
            </p>
          </div>

          {(canEditSavedSheet ||
            canViewRecoverySheet ||
            canDownloadCompletedSheet) && (
            <div className="flex shrink-0 flex-col gap-2 min-[390px]:flex-row min-[390px]:flex-wrap">
              {canDownloadCompletedSheet && (
                <button
                  type="button"
                  onClick={onDownload}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-orange-300 bg-white px-4 text-xs font-extrabold text-orange-700 transition hover:bg-orange-50 sm:text-sm"
                >
                  <DownloadIcon />
                  Download CSV
                </button>
              )}

              {canEditSavedSheet && (
                <button
                  type="button"
                  onClick={onEdit}
                  disabled={editing}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-orange-300 bg-white px-4 text-xs font-extrabold text-orange-700 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                >
                  {editing ? 'Opening Edit...' : 'Edit'}
                </button>
              )}

              {canViewRecoverySheet && (
                <Link
                  to={recoverySheetPath}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-orange-500 px-4 text-xs font-bold text-white transition hover:bg-orange-600 sm:text-sm"
                >
                  View Recovery Sheet
                </Link>
              )}
            </div>
          )}
        </div>

        {recoverySheetId && (
          <p className="mt-3 break-all text-[10px] text-slate-500">
            Recovery Sheet ID: {recoverySheetId}
          </p>
        )}
      </section>
    );
  }

  return (
    <section
      className={`rounded-xl border p-3.5 shadow-sm sm:rounded-2xl sm:p-5 ${
        allRowsCompleted
          ? 'border-orange-200 bg-orange-50'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-orange-600">
            Final Save
          </p>
          <h3 className="mt-1 text-lg font-extrabold text-slate-900">
            {allRowsCompleted
              ? 'All Rows Completed'
              : `${completedCount} of ${rows.length} Rows Completed`}
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
            {allRowsCompleted
              ? 'All rows are Complete. Save now to finalize the Raw Recovery Sheet and automatically generate the Recovery Sheet.'
              : 'Mark every available row as Complete. The Save option becomes available only after all rows are completed.'}
          </p>
        </div>

        {allRowsCompleted && (
          <div className="flex shrink-0 flex-col gap-2 min-[390px]:flex-row">
            {canDownloadCompletedSheet && (
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-orange-300 bg-white px-4 text-xs font-extrabold text-orange-700 transition hover:bg-orange-50 sm:text-sm"
              >
                <DownloadIcon />
                Download CSV
              </button>
            )}

            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-orange-500 px-5 text-xs font-extrabold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function ScannedBarcodeTable({
  row,
  canEdit,
  busy,
  onRemoveBarcode,
}) {
  const counts = row.barcodes.reduce(
    (accumulator, barcode) => {
      accumulator[barcode.handNumber] =
        (accumulator[barcode.handNumber] || 0) + 1;
      return accumulator;
    },
    { 4: 0, 5: 0, 6: 0, 8: 0 }
  );

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:rounded-2xl sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-slate-900">Scanned Barcodes</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Row {row.rowNumber} updates immediately after every successful scan.
          </p>
        </div>
        <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-extrabold text-orange-700 sm:text-xs">
          Total {row.barcodes.length}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {[4, 5, 6, 8].map((hand) => (
          <div
            key={hand}
            className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-2 text-center"
          >
            <p className="text-[9px] font-bold text-slate-500">
              {hand}-Hand
            </p>
            <p className="mt-0.5 text-base font-extrabold text-slate-900">
              {counts[hand] || 0}
            </p>
          </div>
        ))}
      </div>

      {row.barcodes.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-xs text-slate-500 sm:text-sm">
          No barcodes scanned for this row yet.
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-2 sm:hidden">
            {[...row.barcodes].reverse().map((barcode, index) => (
              <div
                key={`${barcode.barcodeId}-${index}`}
                className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <strong className="min-w-0 break-all font-mono text-xs text-slate-800">
                    {barcode.barcodeId}
                  </strong>
                  <span className="shrink-0 rounded-md bg-orange-100 px-2 py-1 text-[9px] font-bold text-orange-700">
                    {barcode.category}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-[10px] text-slate-500">
                    Hand {barcode.handNumber} · {formatDateTime(barcode.scannedAt)}
                  </p>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onRemoveBarcode(barcode.barcodeId)}
                      disabled={busy}
                      className="shrink-0 rounded-md border border-red-200 bg-white px-2 py-1 text-[9px] font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="bg-orange-50 text-left text-xs uppercase tracking-wide text-slate-600">
                  <th className="rounded-l-lg px-3 py-2.5">Barcode ID</th>
                  <th className="px-3 py-2.5 text-center">Hand</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className={`px-3 py-2.5 ${canEdit ? '' : 'rounded-r-lg'}`}>
                    Scanned At
                  </th>
                  {canEdit && (
                    <th className="rounded-r-lg px-3 py-2.5 text-center">
                      Action
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...row.barcodes].reverse().map((barcode, index) => (
                  <tr key={`${barcode.barcodeId}-${index}`}>
                    <td className="px-3 py-3 font-mono text-xs font-semibold text-slate-800">
                      {barcode.barcodeId}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-slate-700">
                      {barcode.handNumber}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {barcode.category}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {formatDateTime(barcode.scannedAt)}
                    </td>
                    {canEdit && (
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => onRemoveBarcode(barcode.barcodeId)}
                          disabled={busy}
                          className="rounded-md border border-red-200 px-2 py-1 text-[10px] font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-4 grid gap-2 text-xs text-slate-500 min-[390px]:grid-cols-2">
        <p>
          Started:{' '}
          <strong className="text-slate-700">
            {formatDateTime(row.startedAt)}
          </strong>
        </p>
        <p>
          Completed:{' '}
          <strong className="text-slate-700">
            {formatDateTime(row.completedAt)}
          </strong>
        </p>
      </div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold text-slate-700 sm:text-sm">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function normalizeError(error, fallback) {
  return error.response?.data?.message || error.message || fallback;
}

function formatDateTime(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function BarcodeIcon() {
  return (
    <svg
      viewBox="0 0 64 44"
      className="h-12 w-16 text-white/65"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M5 4v36M11 4v36M16 4v36M25 4v36M30 4v36M39 4v36M45 4v36M50 4v36M59 4v36" />
      <path d="M2 10V2h8M54 2h8v8M62 34v8h-8M10 42H2v-8" />
    </svg>
  );
}
