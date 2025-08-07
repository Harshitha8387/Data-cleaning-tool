document.addEventListener('DOMContentLoaded', () => {
  const cleanBtn = document.getElementById('cleanBtn');
  const fileInput = document.getElementById('fileInput');
  const fileNameDisplay = document.getElementById('fileName');
  const statusText = document.getElementById('status');

  let selectedFile = null;

  // Update file name display when a file is selected
  fileInput.addEventListener('change', (event) => {
    if (event.target.files.length > 0) {
      selectedFile = event.target.files[0];
      fileNameDisplay.textContent = selectedFile.name;
      statusText.textContent = '';
      statusText.classList.remove('success', 'error');
      cleanBtn.disabled = false; // Enable the clean button
    } else {
      selectedFile = null;
      fileNameDisplay.textContent = 'Choose CSV File...';
      cleanBtn.disabled = true; // Disable if no file
    }
  });

  // Initially disable the clean button until a file is selected
  cleanBtn.disabled = true;

  cleanBtn.addEventListener('click', () => {
    if (!selectedFile) {
      statusText.textContent = 'Please select a CSV file first.';
      statusText.className = 'message error';
      return;
    }

    statusText.textContent = 'Processing data in browser...';
    statusText.className = 'message';
    cleanBtn.disabled = true;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const csvString = e.target.result;
        
        // Manual CSV Parsing
        const lines = csvString.split(/\r\n|\n/);
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '')); // Basic split, trim, remove quotes
        
        let data = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line === '') continue; // Skip empty lines

          // Basic split by comma, handling quoted commas for simplicity.
          // For robust CSV parsing, a regex or state machine is needed,
          // but for general cases, this should suffice.
          const values = line.match(/(?:[^,"']+|"[^"]*"|'[^']*')+/g); 
          if (!values || values.length !== headers.length) {
              // Skip malformed lines or those not matching header count
              console.warn(`Skipping malformed line: ${line}`);
              continue;
          }

          let row = {};
          for (let j = 0; j < headers.length; j++) {
            row[headers[j]] = values[j].trim().replace(/^"|"$/g, ''); // Trim and remove outer quotes
          }
          data.push(row);
        }

        if (data.length === 0) {
          statusText.textContent = 'CSV file is empty or contains no valid data after initial parsing.';
          statusText.className = 'message error';
          cleanBtn.disabled = false;
          return;
        }

        // 1. Drop Duplicates
        const uniqueDataMap = new Map();
        data.forEach(row => {
            const rowString = JSON.stringify(row); // Convert row object to string for comparison
            uniqueDataMap.set(rowString, row);
        });
        let cleanedData = Array.from(uniqueDataMap.values());

        // 2. Drop rows with NaN/empty values
        cleanedData = cleanedData.filter(row => {
          for (const key in row) {
            // Check for null, undefined, or empty string after trimming whitespace
            if (row[key] === null || row[key] === undefined || (typeof row[key] === 'string' && row[key].trim() === '')) {
              return false; // This row contains an empty/NaN value, so filter it out
            }
          }
          return true; // Keep the row
        });

        if (cleanedData.length === 0) {
          statusText.textContent = 'No valid data remaining after cleaning.';
          statusText.className = 'message error';
          cleanBtn.disabled = false;
          return;
        }

        // Convert the cleaned data back to CSV string
        // Reconstruct headers with quotes if they contain commas or spaces
        const escapedHeaders = headers.map(h => {
            if (h.includes(',') || h.includes('"') || h.includes('\n') || h.includes(' ')) {
                // Escape existing quotes and wrap in quotes
                return `"${h.replace(/"/g, '""')}"`;
            }
            return h;
        }).join(',');

        let cleanedCsvLines = [escapedHeaders];
        cleanedData.forEach(row => {
          const rowValues = headers.map(header => {
            let value = row[header];
            if (value === null || value === undefined) value = ''; // Treat null/undefined as empty string for CSV output
            value = String(value); // Ensure it's a string

            // Basic CSV escaping: double quotes and wrap in quotes if contains comma, quote, or newline
            if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          });
          cleanedCsvLines.push(rowValues.join(','));
        });
        const cleanedCsvString = cleanedCsvLines.join('\n');


        // Create a Blob from the cleaned CSV string
        const blob = new Blob([cleanedCsvString], { type: 'text/csv;charset=utf-8;' });

        // Create a temporary URL for the Blob
        const url = URL.createObjectURL(blob);

        // Prompt user to save the file
        const a = document.createElement('a');
        a.href = url;
        a.download = `cleaned_${selectedFile.name}`; // Suggest a default filename, user can change it
        document.body.appendChild(a); // Append to body (required for Firefox)
        a.click(); // Programmatically click the link to trigger download
        document.body.removeChild(a); // Remove the link

        // Revoke the object URL to free up memory
        URL.revokeObjectURL(url);

        statusText.textContent = 'Processing complete. File download initiated.';
        statusText.className = 'message success';
        cleanBtn.disabled = false; // Re-enable button

      } catch (error) {
        statusText.textContent = `Error processing file: ${error.message}`;
        statusText.className = 'message error';
        cleanBtn.disabled = false;
      }
    };

    reader.onerror = () => {
      statusText.textContent = 'Failed to read the file.';
      statusText.className = 'message error';
      cleanBtn.disabled = false;
    };

    reader.readAsText(selectedFile); // Read the file content as text
  });
});