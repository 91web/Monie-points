"use client"

import type React from "react"

import { useState } from "react"
import { styled } from "@mui/material/styles"
import {
  Alert,
  AppBar,
  Box,
  Button,
  Container,
  Grid,
  LinearProgress,
  Paper,
  Toolbar,
  Typography,
  CircularProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  IconButton,
} from "@mui/material"
import {
  BarChart as BarChartIcon,
  CalendarToday as CalendarIcon,
  CloudUpload as CloudUploadIcon,
  AccessTime as ClockIcon,
  People as PeopleIcon,
  Delete as DeleteIcon,
  InfoOutlined as InfoIcon,
  Save as SaveIcon,
  Close as CloseIcon,
} from "@mui/icons-material"

// Define the structure of our metrics data
interface Metrics {
  highestSalesVolume: { date: string; volume: number }
  highestSalesValue: { date: string; value: number }
  mostSoldProduct: { id: string; volume: number }
  highestSalesStaff: { id: string; sales: number }
  highestHour: { hour: number; volume: number }
}

interface SavedAnalytics {
  id: string
  filename: string
  metrics: Metrics
  savedAt: string
  prefix: string
}

// Hide the file input but keep it accessible
const VisuallyHiddenInput = styled("input")({
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: 1,
  overflow: "hidden",
  position: "absolute",
  bottom: 0,
  left: 0,
  whiteSpace: "nowrap",
  width: 1,
})

// Reusable card component for displaying metrics
const MetricCard = ({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string
  value: string | number
  subtitle: string
  icon: React.ReactNode
}) => (
  <Paper
    sx={{
      p: 2,
      display: "flex",
      flexDirection: "column",
      height: 140,
      position: "relative",
      overflow: "hidden",
    }}
    elevation={2}
  >
    <Box sx={{ position: "absolute", right: 8, top: 8, opacity: 0.2 }}>{icon}</Box>
    <Typography component="h2" variant="subtitle1" color="text.secondary">
      {title}
    </Typography>
    <Typography component="p" variant="h4" sx={{ my: 1, fontWeight: "bold" }}>
      {value}
    </Typography>
    <Typography variant="caption" color="text.secondary">
      {subtitle}
    </Typography>
  </Paper>
)

// Update the data format guide
const dataFormatGuide = `
Expected Format (CSV/TXT):
salesStaffId,timestamp,[product1:quantity|product2:quantity...],amount

Example:
8,2025-01-01T14:56:52,[149543:7|649302:7|45995:8|231096:2],30160.973

Where:
- salesStaffId: Staff ID number
- timestamp: ISO format (YYYY-MM-DDTHH:mm:ss)
- products: List of productId:quantity pairs in square brackets, separated by |
- amount: Sale amount in Naira (decimal number)

Sample line from data:
8,2025-01-01T14:56:52,[149543:7|649302:7|45995:8|231096:2|267360:6|585092:7|182666:2|180450:4|525080:3|152145:7|628952:2|386669:8|950020:2],30160.973
`

export default function MonieshopAnalytics() {
  // Add new state variables
  const [openSaveDialog, setOpenSaveDialog] = useState(false)
  const [prefix, setPrefix] = useState("")
  const [snackbar, setSnackbar] = useState({ open: false, message: "" })
  const [originalFilename, setOriginalFilename] = useState("")

  // State management
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isReading, setIsReading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFormatGuide, setShowFormatGuide] = useState(true)

  // Clear all data and reset the dashboard
  const handleClear = () => {
    setMetrics(null)
    setError(null)
    setShowFormatGuide(true)
    // Reset file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      fileInput.value = ""
    }
  }

  // Handle file upload and processing
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      setError("Please select a file to upload")
      return
    }

    // Save original filename without extension
    setOriginalFilename(file.name.replace(/\.[^/.]+$/, ""))

    // Start loading states
    setIsReading(true)
    setError(null)
    setIsProcessing(true)
    setShowFormatGuide(false)

    const reader = new FileReader()

    // Update the file processing logic in handleFileUpload
    reader.onload = (e: ProgressEvent<FileReader>) => {
      setIsReading(false)
      try {
        const result = e.target?.result
        if (typeof result !== "string") {
          throw new Error("Invalid file content")
        }

        // Split into lines and filter empty lines
        const transactions = result
          .split("\n")
          .filter((line) => line.trim())
          .map((line) => line.trim())

        if (transactions.length === 0) {
          throw new Error("No transactions found in file")
        }

        // Initialize tracking objects
        const dailySales: { [key: string]: { volume: number; value: number } } = {}
        const productSales: { [key: string]: number } = {}
        const staffSales: { [key: string]: number } = {}
        const hourlyVolumes: { [key: number]: number } = {}

        // Process each transaction
        transactions.forEach((transaction, index) => {
          try {
            // Split transaction into components
            const [salesStaffId, timeStr, products, saleAmount] = transaction.split(",")

            // Validate and parse timestamp
            const date = new Date(timeStr)
            if (isNaN(date.getTime())) {
              throw new Error(`Invalid timestamp at line ${index + 1}`)
            }

            // Format date for daily tracking (YYYY-MM-DD)
            const dateKey = date.toISOString().split("T")[0]
            const hour = date.getHours()
            const amount = Number.parseFloat(saleAmount)

            if (isNaN(amount)) {
              throw new Error(`Invalid amount at line ${index + 1}`)
            }

            // Initialize daily sales if needed
            if (!dailySales[dateKey]) {
              dailySales[dateKey] = { volume: 0, value: 0 }
            }
            dailySales[dateKey].value += amount

            // Process products
            // Remove brackets and split by pipe
            const productList = products.slice(1, -1).split("|")
            productList.forEach((product) => {
              const [id, quantity] = product.split(":")
              const qty = Number.parseInt(quantity)
              if (!isNaN(qty) && qty > 0) {
                productSales[id] = (productSales[id] || 0) + qty
                dailySales[dateKey].volume += qty
              }
            })

            // Update staff sales
            staffSales[salesStaffId] = (staffSales[salesStaffId] || 0) + amount

            // Update hourly volumes
            hourlyVolumes[hour] = (hourlyVolumes[hour] || 0) + 1
          } catch (err) {
            console.warn(`Error processing transaction at line ${index + 1}:`, err)
          }
        })

        // Calculate final metrics
        setMetrics({
          highestSalesVolume: Object.entries(dailySales).reduce(
            (max, [date, data]) => (data.volume > (max.volume || 0) ? { date, volume: data.volume } : max),
            { date: "", volume: 0 },
          ),
          highestSalesValue: Object.entries(dailySales).reduce(
            (max, [date, data]) => (data.value > (max.value || 0) ? { date, value: data.value } : max),
            { date: "", value: 0 },
          ),
          mostSoldProduct: Object.entries(productSales).reduce(
            (max, [id, volume]) => (volume > (max.volume || 0) ? { id, volume } : max),
            { id: "", volume: 0 },
          ),
          highestSalesStaff: Object.entries(staffSales).reduce(
            (max, [id, sales]) => (sales > (max.sales || 0) ? { id, sales } : max),
            { id: "", sales: 0 },
          ),
          highestHour: Object.entries(hourlyVolumes).reduce(
            (max, [hour, volume]) => (volume > (max.volume || 0) ? { hour: Number.parseInt(hour), volume } : max),
            { hour: 0, volume: 0 },
          ),
        })
      } catch (error) {
        setError(error instanceof Error ? error.message : "Error processing file")
      } finally {
        setIsProcessing(false)
      }
    }

    reader.onerror = () => {
      setError("Failed to read file")
      setIsProcessing(false)
      setIsReading(false)
    }

    // Start reading the file
    reader.readAsText(file)
  }

  // Add save functionality
  const handleSave = () => {
    if (!metrics) return

    const timestamp = new Date().toISOString()
    const savedData: SavedAnalytics = {
      id: `analytics-${Date.now()}`,
      filename: originalFilename,
      metrics,
      savedAt: timestamp,
      prefix,
    }

    try {
      // Get existing analytics from localStorage
      const existingData = localStorage.getItem("monieshop-analytics")
      const allAnalytics: SavedAnalytics[] = existingData ? JSON.parse(existingData) : []

      // Add new analytics
      allAnalytics.push(savedData)

      // Save back to localStorage
      localStorage.setItem("monieshop-analytics", JSON.stringify(allAnalytics))

      // Show success message
      setSnackbar({
        open: true,
        message: `Analytics saved successfully as "${prefix} - ${originalFilename}"`,
      })

      // Close dialog
      setOpenSaveDialog(false)
      setPrefix("")
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Error saving analytics. Please try again.",
      })
    }
  }

  // Handle dialog close
  const handleCloseDialog = () => {
    setOpenSaveDialog(false)
    setPrefix("")
  }

  // Add this right before the return statement
  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false })
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", flexDirection: "column" }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <BarChartIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Monieshop Analytics
          </Typography>
          <Tooltip title="View Data Format Guide">
            <Button startIcon={<InfoIcon />} onClick={() => setShowFormatGuide(true)} sx={{ mr: 2 }}>
              Format Guide
            </Button>
          </Tooltip>
          <Button
            component="label"
            variant="contained"
            startIcon={isReading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
            sx={{ mr: 2 }}
            disabled={isReading || isProcessing}
          >
            {isReading ? "Reading File..." : "Upload Data"}
            <VisuallyHiddenInput type="file" onChange={handleFileUpload} accept=".txt,.csv" />
          </Button>
        </Toolbar>
      </AppBar>

      {/* Loading Progress */}
      {(isReading || isProcessing) && (
        <Box sx={{ width: "100%", position: "relative" }}>
          <LinearProgress />
          <Typography
            variant="caption"
            sx={{
              position: "absolute",
              top: "4px",
              left: "50%",
              transform: "translateX(-50%)",
              backgroundColor: "background.paper",
              px: 2,
            }}
          >
            {isReading ? "Reading file..." : "Processing data..."}
          </Typography>
        </Box>
      )}

      <Container component="main" sx={{ flex: 1, py: 4 }}>
        {/* Error Messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Data Format Guide */}
        {showFormatGuide && (
          <Alert severity="info" sx={{ mb: 2 }} onClose={() => setShowFormatGuide(false)}>
            <Typography variant="subtitle2" gutterBottom>
              Data Format Guide
            </Typography>
            <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{dataFormatGuide}</pre>
          </Alert>
        )}

        {/* Metrics Display */}
        {isProcessing ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6} lg={4}>
              <MetricCard
                title="Highest Daily Sales Volume"
                value={metrics?.highestSalesVolume.volume || 0}
                subtitle={`on ${metrics?.highestSalesVolume.date || "N/A"}`}
                icon={<CalendarIcon sx={{ fontSize: 40 }} />}
              />
            </Grid>
            <Grid item xs={12} md={6} lg={4}>
              <MetricCard
                title="Highest Daily Sales Value"
                value={`₦${metrics?.highestSalesValue.value.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}`}
                subtitle={`on ${metrics?.highestSalesValue.date || "N/A"}`}
                icon={<CalendarIcon sx={{ fontSize: 40 }} />}
              />
            </Grid>
            <Grid item xs={12} md={6} lg={4}>
              <MetricCard
                title="Most Sold Product"
                value={`Product ${metrics?.mostSoldProduct.id || "N/A"}`}
                subtitle={`${metrics?.mostSoldProduct.volume || 0} units sold`}
                icon={<BarChartIcon sx={{ fontSize: 40 }} />}
              />
            </Grid>
            <Grid item xs={12} md={6} lg={4}>
              <MetricCard
                title="Top Sales Staff"
                value={`Staff ${metrics?.highestSalesStaff.id || "N/A"}`}
                subtitle={`₦${metrics?.highestSalesStaff.sales.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"} in sales`}
                icon={<PeopleIcon sx={{ fontSize: 40 }} />}
              />
            </Grid>
            <Grid item xs={12} md={6} lg={4}>
              <MetricCard
                title="Peak Sales Hour"
                value={`${metrics?.highestHour.hour.toString().padStart(2, "0")}:00`}
                subtitle={`${metrics?.highestHour.volume || 0} transactions`}
                icon={<ClockIcon sx={{ fontSize: 40 }} />}
              />
            </Grid>
          </Grid>
        )}

        {/* Action Buttons - Update this section */}
        {metrics && (
          <Box sx={{ mt: 4, display: "flex", justifyContent: "center", gap: 2 }}>
            <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={handleClear}>
              Clear Data
            </Button>
            <Button variant="outlined" color="primary" startIcon={<SaveIcon />} onClick={() => setOpenSaveDialog(true)}>
              Save Analytics
            </Button>
            <Button
              component="label"
              variant="contained"
              startIcon={<CloudUploadIcon />}
              disabled={isReading || isProcessing}
            >
              Upload New Data
              <VisuallyHiddenInput type="file" onChange={handleFileUpload} accept=".txt,.csv" />
            </Button>
          </Box>
        )}

        {/* Save Dialog */}
        <Dialog open={openSaveDialog} onClose={handleCloseDialog}>
          <DialogTitle>Save Analytics</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                File: {originalFilename}
              </Typography>
              <TextField
                autoFocus
                margin="dense"
                label="Enter Prefix (e.g., Analytics 1)"
                type="text"
                fullWidth
                variant="outlined"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                helperText="This prefix will help identify your saved analytics"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSave} variant="contained" disabled={!prefix.trim()}>
              Save
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar for feedback */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleSnackbarClose}
          message={snackbar.message}
          action={
            <IconButton size="small" color="inherit" onClick={handleSnackbarClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        />
      </Container>

      {/* Footer */}
      <Box
        component="footer"
        sx={{ py: 2, px: 2, mt: "auto", backgroundColor: "background.paper", borderTop: 1, borderColor: "divider" }}
      >
        <Container>
          <Typography variant="body2" color="text.secondary" align="center">
            Built with Next.js and Material-UI
          </Typography>
        </Container>
      </Box>
    </Box>
  )
}

