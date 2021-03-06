# **Aura Helper Metadata Factory Module**

[![Version](https://img.shields.io/npm/v/@aurahelper/metadata-factory?logo=npm)](https://www.npmjs.com/package/@aurahelper/metadata-factory)
[![Total Downloads](https://img.shields.io/npm/dt/@aurahelper/metadata-factory?logo=npm)](https://www.npmjs.com/package/@aurahelper/metadata-factory)
[![Downloads/Month](https://img.shields.io/npm/dm/@aurahelper/metadata-factory?logo=npm)](https://www.npmjs.com/package/@aurahelper/metadata-factory)
[![Issues](https://img.shields.io/github/issues/jjlongoria/aura-helper-metadata-factory)](https://github.com/JJLongoria/aura-helper-metadata-factory/issues)
[![Known Vulnerabilities](https://snyk.io/test/github/JJLongoria/aura-helper-metadata-factory/badge.svg)](https://snyk.io/test/github/JJLongoria/aura-helper-metadata-factory)
[![Code Size](https://img.shields.io/github/languages/code-size/jjlongoria/aura-helper-metadata-factory)](https://github.com/JJLongoria/aura-helper-metadata-factory)
[![License](https://img.shields.io/github/license/jjlongoria/aura-helper-metadata-factory?logo=github)](https://github.com/JJLongoria/aura-helper-metadata-factory/blob/master/LICENSE)

The Metadata Factory Module is an Util Module to Aura Helper Framework to create Metadata Details, Metadata Folder Map or Metadata JSON Object from several sources like git, package file or the file system project among others.

This module support other modules like [@ah/connector](#https://github.com/JJLongoria/aura-helper-connector) among others, to download the MetadataTypes available in your org or to decribe the specified or all Metadata Types. 

---

## *Table of Contents*

- [**MetadataFactory Class**](#metadatafactory-class)

- [**Metadata JSON Format**](#metadata-json-format)

---

# [**MetadataFactory Class**](#metadatafactory-class)

Class with several util methods to create the Aura Helper Metadata JSON from several sources like queries result, file system, git... or work with other SObject or Metadata object types like MetadataDetails, MetadataFolderMap or SOjects collections.

# [**Methods**](#metadatafactory-class-methods)

  - [**createMetadataDetails(responseOrPath)**](#createmetadatadetailsresponseorpath)

    Method to create the MeadataDetails objects collection from SFDX describe metadata types used in Aura Helper Connector. Can process the response directly or process a file with the response content

  - [**createMetadataTypeFromRecords(metadataTypeName, records, foldersByType, namespacePrefix, addAll)**](#createmetadatatypefromrecordsmetadatatypename-records-foldersbytype-namespaceprefix-addall)

    Method to create Metadata Types JSON data from the results of a query (Used to create types from Reports, Dashboards, EmailTemplates...). Used in Aura Helper Connector to process the responses

  - [**createMetedataTypeFromResponse(response, metadataTypeName, namespacePrefix, addAll)**](#createmetedatatypefromresponseresponse-metadatatypename-namespaceprefix-addall)

    Method to create the Metadata Types from SFDX Command. Used in Aura Helper Connector to process the responses

  - [**createNotIncludedMetadataType(metadataTypeName)**](#createnotincludedmetadatatypemetadatatypename)

    Method to create not included Metadata Types into the responses of SFDX Commands like StandardValueSet for Standard Picklist values

  - [**createSObjectFromJSONSchema(strJson)**](#createsobjectfromjsonschemastrjson)

    Method to create a SObject instance from the response of describe SObjects command from SFDX

  - [**createSObjectsFromFileSystem(sObjectsPath)**](#createsobjectsfromfilesystemsobjectspath)

    Method to extract the SObjects data from the file system into an object with the SObject API Names in lower case as keys, and the SObject instance as value

  - [**createFolderMetadataMap(metadataDetails)**](#createfoldermetadatamapmetadatadetails)

    Method to create a Map to relate the directory name to the related Metadata Detail. Including subtypes like SObejct fields, indexses...

  - [**createMetadataTypesFromFileSystem(folderMapOrDetails, root)**](#createmetadatatypesfromfilesystemfoldermapordetails-root-groupglobalactions)

    Method to create the Metadata JSON Object with the files and data from your local project.

  - [**createMetadataTypesFromPackageXML(pathOrContent)**](#createmetadatatypesfrompackagexmlpathorcontent)

    Method to create the Metadata JSON Object from a package XML file

  - [**createMetadataTypesFromGitDiffs(root, gitDiffs, folderMapOrDetails)**](#createmetadatatypesfromgitdiffsroot-gitdiffs-foldermapordetails)

    Method to create the Metadata JSON Object from the Git Diffs to able to create a Package from a git differences automatically and deploy it

  - [**deserializeMetadataTypes(jsonDataOrJsonStr, removeEmptyTypes)**](#deserializemetadadeserializemetadatatypesjsondataorjsonstr-removeemptytypespes)

    Method to convert a JSON String with Metadata JSON format or a Metadata JSON untyped Object to a Metadata JSON Object with MetadataType, MetadataObject and MetadataItem objects

---
## [**createMetadataDetails(responseOrPath)**](#createmetadatadetailsresponseorpath)
Method to create the MeadataDetails objects collection from SFDX describe metadata types used in Aura Helper Connector. Can process the response directly or process a file with the response content

### **Parameters:**
  - **responseOrPath**: SFDX String response or JSON response or path to the file with the response data 
    - `string` | `any`

### **Return:**
Array with the MetadataDetails for all metadata types received on the response
- `MetadataDetail[]`

### **Throws:**
This method can throw the next exceptions:

- **`WrongFilePathException`**: If the path is not a String or cant convert to absolute path
- **`FileNotFoundException`**: If the file not exists or not have access to it
- **`InvalidFilePathException`**: If the path is not a file
- **`WrongFormatException`**: If file is not a JSON file or the String response is not a JSON

### **Examples:**
**Create Metadata Details from JSON Object**
```javascript
    import { MetadataFactory } from '@aurahelper/metadata-factory';
    

    // Objects to create a Metadata details
    const objects = [
            {
                directoryName: 'objects',
                inFolder: true,
                metaFile: true,
                suffix: 'object',
                xmlName: 'CustomObject',
                childXmlNames: [
                    'CustomField',
                    'RecordType',
                    'ValidationRule',
                    'Index',
                    'CompactLayout',
                    'BussinesProcess'
                ]
            },
            {
                directoryName: 'layouts',
                inFolder: true,
                metaFile: true,
                suffix: 'layout',
                xmlName: 'Layout',
            }
        ];
    const metadataDetails = MetadataFactory.createMetadataDetails(objects);
    for(const detail of metadataDetails){
        console.log(detail);
    }
```
**Create Metadata Details from SFDX Response**
```javascript
    import { MetadataFactory } from '@aurahelper/metadata-factory';
    
    const simulatedResponseObj = {
                "status": 0,
                "result": {
                    "metadataObjects": [
                    {
                        "directoryName": "installedPackages",
                        "inFolder": false,
                        "metaFile": false,
                        "suffix": "installedPackage",
                        "xmlName": "InstalledPackage"
                    },
                    {
                        "childXmlNames": [
                        "CustomLabel"
                        ],
                        "directoryName": "labels",
                        "inFolder": false,
                        "metaFile": false,
                        "suffix": "labels",
                        "xmlName": "CustomLabels"
                    },
                    {
                        "directoryName": "staticresources",
                        "inFolder": false,
                        "metaFile": true,
                        "suffix": "resource",
                        "xmlName": "StaticResource"
                    },
                    {
                        "directoryName": "scontrols",
                        "inFolder": false,
                        "metaFile": true,
                        "suffix": "scf",
                        "xmlName": "Scontrol"
                    },
                    {
                        "directoryName": "certs",
                        "inFolder": false,
                        "metaFile": true,
                        "suffix": "crt",
                        "xmlName": "Certificate"
                    }
                }
            };
    
    const simulatedStrResponse = JSON.stringify(simulatedResponseObj);

    // Create Metadata Types from JSON Object response
    const metadataDetailsFromObject = MetadataFactory.createMetadataDetails(simulatedResponseObj);
    for(const detail of metadataDetailsFromObject){
        console.log(detail);
    }

    // Create Metadata Types from JSON String response
    const metadataDetailsFromStr = MetadataFactory.createMetadataDetails(simulatedStrResponse);
    for(const detail of metadataDetailsFromStr){
        console.log(detail);
    }
```
**Create Metadata Details from response stored on file**
```javascript
    import { MetadataFactory } from '@aurahelper/metadata-factory';

    const responseFilePath = 'path/to/stored/response.json';
    const metadataDetailsFromObject = MetadataFactory.createMetadataDetails(responseFilePath);
    for(const detail of metadataDetailsFromStr){
        console.log(detail);
    }
```
---

## [**createMetadataTypeFromRecords(metadataTypeName, records, foldersByType, namespacePrefix, addAll)**](#createmetadatatypefromrecordsmetadatatypename-records-foldersbytype-namespaceprefix-addall)
Method to create Metadata Types JSON data from the results of a query (Used to create types from Reports, Dashboards, EmailTemplates...). Used in Aura Helper Connector to process the responses

### **Parameters:**
  - **metadataTypeName**: Metadata Type API Name
    - `string`
  - **records**: List of records to create the Metadata Types
    - `any[]`
  - **foldersByType**: Object with the objects folders (email folders, document folders...) related by Metadata Type
    - `any`
  - **namespacePrefix**: Namespace prefix from the org
    - `string`
  - **addAll**: true to add all elements in records list, false to add only your org namespace objects
    - `boolean`

### **Return:**
Return a Metadata Type Object with the records data
- `MetadataType`

### **Examples:**
**Create Metadata JSON types from Records**
```javascript
    import { MetadataFactory } from '@aurahelper/metadata-factory';
    const records = [
            {
                FolderName: 'FolderName1',
                NamespacePrefix: '',
                DeveloperName: 'devName1'
            },
            {
                FolderName: 'Private Reports',
                NamespacePrefix: '',
                DeveloperName: 'devName3'
            },
            {
                FolderName: 'FolderName2',
                NamespacePrefix: '',
                DeveloperName: 'devName2'
            },
            {
                FolderName: 'FolderName4',
                NamespacePrefix: '',
                FolderId: 'folder3',
                DeveloperName: 'devName4'
            }
        ];
        const foldersByType = {
            Report: [
                {
                    Name: 'FolderName1',
                    Id: 'folder1',
                    DeveloperName: 'folder1',
                },
                {
                    Name: 'FolderName2',
                    Id: 'folder2',
                    DeveloperName: 'folder2',
                }
            ],
            EmailTemplate: [
                {
                    Name: 'FolderName3',
                    FolderId: 'folder3',
                    Id: 'folder3',
                    DeveloperName: 'folder3',
                }
            ]
        };

    const metadataTypeAPIName = 'Report';
    const namespacePrefix = '';
    const addAll = true;

    const metadataTypes = MetadataFactory.createMetadataTypeFromRecords(metadataTypeAPIName, records, foldersByType, namespacePrefix, addAll);
    for(const typeAPIName of Object.keys(metadataTypes)){
        const metadataType = metadataTypes[typeAPIName];
        constole.log(metadataType);
    }
```
---

## [**createMetedataTypeFromResponse(response, metadataTypeName, namespacePrefix, addAll)**](#createmetedatatypefromresponseresponse-metadatatypename-namespaceprefix-addall)
Method to create the Metadata Types from SFDX Command. Used in Aura Helper Connector to process the responses

### **Parameters:**
- **metadataTypeName**: Metadata Type API Name
  - `string`
- **response**: String response or JSON response from SFDX command
  - `string` | `any`
- **namespacePrefix**: Namespace prefix from the org
  - `string`
- **addAll**: true to add all elements in records list, false to add only your org namespace objects
  - `boolean`

### **Return:**
Return a Metadata Type Object with the response data
- `MetadataType | undefined`

### **Throws:**
This method can throw the next exceptions:

- **`WrongFormatException`**: If the response is not a JSON String or JSON Object

### **Examples:**
**Create Custom Object Metadata Types from Response Object**
```javascript
    import { MetadataFactory } from '@aurahelper/metadata-factory';

    const simulatedCustomObjectsResponse = {
            status: 0,
            result: [
                {
                    fullName: 'Account',
                    namespacePrefix: '',
                },
                {
                    fullName: 'Case',
                    namespacePrefix: '',
                },
                {
                    fullName: 'Opportunity',
                    namespacePrefix: '',
                },
                {
                    fullName: 'Lead',
                    namespacePrefix: '',
                }
            ]
        };
    
    const metadataTypeAPIName = 'CustomObject';
    const namespacePrefix = '';
    const addAll = true;

    const metadataType = MetadataFactory.createMetedataTypeFromResponse(metadataTypeAPIName, simulatedCustomObjectsResponse, namespacePrefix, addAll);

    console.log(metadataType);
```
**Create Custom Object Metadata Types from Response String**
```javascript
    import { MetadataFactory } from '@aurahelper/metadata-factory';

    const simulatedCustomObjectsResponse = {
            status: 0,
            result: [
                {
                    fullName: 'Account',
                    namespacePrefix: '',
                },
                {
                    fullName: 'Case',
                    namespacePrefix: '',
                },
                {
                    fullName: 'Opportunity',
                    namespacePrefix: '',
                },
                {
                    fullName: 'Lead',
                    namespacePrefix: '',
                }
            ]
        };
    
    const strResponse = JSON.stringify(simulatedCustomObjectsResponse);
    const metadataTypeAPIName = 'CustomObject';
    const namespacePrefix = '';
    const addAll = true;

    const metadataType = MetadataFactory.createMetedataTypeFromResponse(metadataTypeAPIName, strResponse, namespacePrefix, addAll);

    console.log(metadataType);
```
---
## [**createNotIncludedMetadataType(metadataTypeName)**](#createnotincludedmetadatatypemetadatatypename)
Method to create not included Metadata Types into the responses of SFDX Commands like StandardValueSet for Standard Picklist values

### **Parameters:**
- **metadataTypeName**: Metadata Type API Name
  - `string`

### **Return:**
Return the selected Metadata Type with childs data or undefined if not exists on not selected metadata types
- `MetadataType | undefined`

### **Examples:**
**Create Standard Value Sets Metadata Type**
```javascript
    import { MetadataFactory } from '@aurahelper/metadata-factory';

    const metadataTypeAPIName = 'StandardValueSet';
    const metadataType = MetadataFactory.createNotIncludedMetadataType(metadataTypeAPIName);

    console.log(metadataType);
```
---
## [**createSObjectFromJSONSchema(strJson)**](#createsobjectfromjsonschemastrjson)
Method to create a SObject instance from the response of describe SObjects command from SFDX

### **Parameters:**
- **strJson**: String JSON response
  - `string`

### **Return:**
Return an instance of the SObject or undefined if cant extract the data 
- `SObject | undefined`

### **Examples:**
**Create SObject from String JSON Response**
```javascript
    import { MetadataFactory } from '@aurahelper/metadata-factory';
    
    const simulatedObjResponse = {
            "status": 0,
            "result": {
                "actionOverrides": [],
                "activateable": false,
                "associateEntityType": null,
                "associateParentEntity": null,
                "childRelationships": [
                {
                    "cascadeDelete": false,
                    "childSObject": "Account",
                    "deprecatedAndHidden": false,
                    "field": "ParentId",
                    "junctionIdListNames": [],
                    "junctionReferenceTo": [],
                    "relationshipName": "ChildAccounts",
                    "restrictedDelete": false
                },
                {
                    "cascadeDelete": false,
                    "childSObject": "AccountChangeEvent",
                    "deprecatedAndHidden": false,
                    "field": "ParentId",
                    "junctionIdListNames": [],
                    "junctionReferenceTo": [],
                    "relationshipName": null,
                    "restrictedDelete": false
                },
                {
                    "cascadeDelete": true,
                    "childSObject": "AccountCleanInfo",
                    "deprecatedAndHidden": false,
                    "field": "AccountId",
                    "junctionIdListNames": [],
                    "junctionReferenceTo": [],
                    "relationshipName": "AccountCleanInfos",
                    "restrictedDelete": false
                },
                {
                    ...
                },
                {
                    ...
                },
                {
                    ...
                },
                {
                    ...
                }
            }
        }
    
    const strResponse = JSON.stringify(simulatedObjResponse);
    const SObject = MetadataFactory.createSObjectFromJSONSchema(strResponse);

    console.log(SObject);
```
---
## [**createSObjectsFromFileSystem(sObjectsPath)**](#createsobjectsfromfilesystemsobjectspath)
Method to extract the SObjects data from the file system into an object with the SObject API Names in lower case as keys, and the SObject instance as value

### **Parameters:**
- **sObjectsPath**: Path to the SObjects folder
  - `string`

### **Return:**
Return an Object with the stored SObjects data with the name in lower case as key, and the SObject instance as value 
- `{ [key: string]: SObject }`

### **Throws:**
This method can throw the next exceptions:

- **`WrongDirectoryPathException`**: If the sObjects path is not a String or can't convert to absolute path
- **`DirectoryNotFoundException`**: If the directory not exists or not have access to it
- **`InvalidDirectoryPathException`**: If the path is not a directory

### **Examples:**
**Get stored SObjects data on a Salesforce Project**
```javascript
    import { MetadataFactory } from '@aurahelper/metadata-factory';

    const sObjectsFolder = './test/assets/SFDXProject/force-app/main/default/objects'
    const sObjects = MetadataFactory.createSObjectsFromFileSystem(sObjectsFolder);

    for(const sObjKey of Objects.keys(sObjects)){
        const sObject = sObjects[sObjKey];
        console.log(sObject);
    }
```
---

## [**createFolderMetadataMap(metadataDetails)**](#createfoldermetadatamapmetadatadetails)
Method to create a Map to relate the directory name to the related Metadata Detail. Including subtypes like SObejct fields, indexses...

### **Parameters:**
- **metadataDetails**: Metadata details list to create the Metadata Folder map
  - `MetadataDetail[]`

### **Return:**
Return an object with the directory name as key, and Metadata Detail as value
- `{ [key: string]: MetadataDetail }`

### **Examples:**
**Create Metadata Folder Map**
```javascript
    import { MetadataFactory } from '@aurahelper/metadata-factory';

    const simulatedResponseObj = {
                "status": 0,
                "result": {
                    "metadataObjects": [
                    {
                        "directoryName": "installedPackages",
                        "inFolder": false,
                        "metaFile": false,
                        "suffix": "installedPackage",
                        "xmlName": "InstalledPackage"
                    },
                    {
                        "childXmlNames": [
                        "CustomLabel"
                        ],
                        "directoryName": "labels",
                        "inFolder": false,
                        "metaFile": false,
                        "suffix": "labels",
                        "xmlName": "CustomLabels"
                    },
                    {
                        "directoryName": "staticresources",
                        "inFolder": false,
                        "metaFile": true,
                        "suffix": "resource",
                        "xmlName": "StaticResource"
                    },
                    {
                        "directoryName": "scontrols",
                        "inFolder": false,
                        "metaFile": true,
                        "suffix": "scf",
                        "xmlName": "Scontrol"
                    },
                    {
                        "directoryName": "certs",
                        "inFolder": false,
                        "metaFile": true,
                        "suffix": "crt",
                        "xmlName": "Certificate"
                    }
                }
            }; 

    const metadataDetails = MetadataFactory.createMetadataDetails(simulatedResponseObj);
    const folderMetadataMap = MetadataFactory.createFolderMetadataMap(metadataDetails);

    for(const folder of Object.keys(folderMetadataMap)){
        const metadataDetail = folderMetadataMap[folder];
        console.log(folder);
        console.log(metadataDetail);
    }
```
---
## [**createMetadataTypesFromFileSystem(folderMapOrDetails, root, groupGlobalActions)**](#createmetadatatypesfromfilesystemfoldermapordetails-root-groupglobalactions)
Method to create the Metadata JSON Object with the files and data from your local project. See [Metadata JSON Format](#metadata-file) section to understand the JSON Metadata Format.

### **Parameters:**
- **folderMapOrDetails**: Folder metadata map created with createFolderMetadataMap() method or MetadataDetails created with createMetadataDetails() method or downloaded with aura Helper Connector Folder map
  - `{ [key: string]: MetadataDetail }` | `MetadataDetail[]`
- **root**: Path to the Salesforce project root
  - `string`
- **groupGlobalActions**: True to group global quick actions on "GlobalActions" group, false to include as object and item. Optional
  - `boolean`

### **Return:**
Returns a Metadata JSON Object with the data from the local project
- `any`

### **Throws:**
This method can throw the next exceptions:

- **`WrongDirectoryPathException`**: If the root path is not a String or can't convert to absolute path
- **`DirectoryNotFoundException`**: If the directory not exists or not have access to it
- **`InvalidDirectoryPathException`**: If the path is not a directory

### **Examples:**
```javascript
    import { MetadataFactory } from '@aurahelper/metadata-factory';

    const simulatedResponseObj = {
                "status": 0,
                "result": {
                    "metadataObjects": [
                    {
                        "directoryName": "installedPackages",
                        "inFolder": false,
                        "metaFile": false,
                        "suffix": "installedPackage",
                        "xmlName": "InstalledPackage"
                    },
                    {
                        "childXmlNames": [
                        "CustomLabel"
                        ],
                        "directoryName": "labels",
                        "inFolder": false,
                        "metaFile": false,
                        "suffix": "labels",
                        "xmlName": "CustomLabels"
                    },
                    {
                        "directoryName": "staticresources",
                        "inFolder": false,
                        "metaFile": true,
                        "suffix": "resource",
                        "xmlName": "StaticResource"
                    },
                    {
                        "directoryName": "scontrols",
                        "inFolder": false,
                        "metaFile": true,
                        "suffix": "scf",
                        "xmlName": "Scontrol"
                    },
                    {
                        "directoryName": "certs",
                        "inFolder": false,
                        "metaFile": true,
                        "suffix": "crt",
                        "xmlName": "Certificate"
                    }
                }
            }; 

    const rootProjectPath = 'path/to/project/root';
    const metadataDetails = MetadataFactory.createMetadataDetails(simulatedResponseObj);
    const metadataTypesFromFileSystem = MetadataFactory.createMetadataTypesFromFileSystem(metadataDetails, rootProjectPath);

    for(const metadataTypeAPIName of Object.keys(metadataTypesFromFileSystem)){
        const metadataType = metadataTypesFromFileSystem[metadataTypeAPIName];
        console.log(metadataType);
    }
```
---
## [**createMetadataTypesFromPackageXML(pathOrContent)**](#createmetadatatypesfrompackagexmlpathorcontent)
Method to create the Metadata JSON Object from a package XML file. See [Metadata JSON Format](#metadata-file) section to understand the JSON Metadata Format.

### **Parameters:**
- **pathOrContent**: Path to the package file or XML String content or XML Parsed content (XMLParser)
  - `string` | `any`
- **groupGlobalActions**: True to group global quick actions on "GlobalActions" group, false to include as object and item. Optional
  - `boolean`


### **Return:**
Return a Metadata JSON Object with the package data
- `{ [key: string]: MetadataType }`

### **Throws:**
This method can throw the next exceptions:

- **`WrongDirectoryPathException`**: If the root path is not a String or can't convert to absolute path
- **`DirectoryNotFoundException`**: If the directory not exists or not have access to it
- **`InvalidDirectoryPathException`**: If the path is not a directory
- **`WrongDatatypeException`**: If the parameter is not an String or valid XML Object parsed with XMLParser
- **`WrongFormatException`**: If the provided data is not a correct Package XML file

### **Examples:**
**Create Metadata JSON Object from XML String**
```javascript
    import { MetadataFactory } from '@aurahelper/metadata-factory';

    const packageStr =  '<?xml version="1.0" encoding="UTF-8"?>' +
                        '<Package xmlns="http://soap.sforce.com/2006/04/metadata">' +
                            '<types>' +
                                '<members>apexClass1</members>' +
                                '<members>apexClass2</members>' +
                                '<members>...</members>' +
                                '<members>apexClassN</members>' +
                            '</types>' +
                            '<types>' + 
                                ...
                                ...
                                ...
                            '</types>' +
                            '<version>50.0</version>' +
                        '</Package>';
    
    const metadataTypesFromPacakge = MetadataFactory.createMetadataTypesFromPackageXML(packageStr);

    for(const metadataTypeAPIName of Object.keys(metadataTypesFromPacakge)){
        const metadataType = metadataTypesFromPacakge[metadataTypeAPIName];
        console.log(metadataType);
    }
```
**Create Metadata JSON Object from XML file**
```javascript
    import { MetadataFactory } from '@aurahelper/metadata-factory';

    const packageFile =  'path/to/package/file/package.xml';
    
    const metadataTypesFromPacakge = MetadataFactory.createMetadataTypesFromPackageXML(packageFile);

    for(const metadataTypeAPIName of Object.keys(metadataTypesFromPacakge)){
        const metadataType = metadataTypesFromPacakge[metadataTypeAPIName];
        console.log(metadataType);
    }
```
**Create Metadata JSON Object from XML parsed object with XMLParser**
```javascript
    import { MetadataFactory } from '@aurahelper/metadata-factory';
    import { XML } from '@aurahelper/languages';
    const XMLParser = XML.XMLParser;

    const packageFile =  'path/to/package/file/package.xml';

    const parsedXML = XMLParser.parse(packageFile);

    const metadataTypesFromPacakge = MetadataFactory.createMetadataTypesFromPackageXML(parsedXML);

    for(const metadataTypeAPIName of Object.keys(metadataTypesFromPacakge)){
        const metadataType = metadataTypesFromPacakge[metadataTypeAPIName];
        console.log(metadataType);
    }
```
---
## [**createMetadataTypesFromGitDiffs(root, gitDiffs, folderMapOrDetails)**](#createmetadatatypesfromgitdiffsroot-gitdiffs-foldermapordetails)
Method to create the Metadata JSON Object from the Git Diffs to able to create a Package from a git differences automatically and deploy it. See [Metadata JSON Format](#metadata-file) section to understand the JSON Metadata Format.

### **Parameters:**
- **root**: Path to the Project Root
  - `string`
- **gitDiffs**: List of git diffs extracted with Aura Helper Git Manager Module
  - `GitDiff[]`
- **folderMapOrDetails**: Folder metadata map created with createFolderMetadataMap() method or MetadataDetails created with createMetadataDetails() method or downloaded with aura Helper Connector
  - `{ [key: string]: MetadataDetail }` | `MetadataDetail[]`
- **groupGlobalActions**: True to group global quick actions on "GlobalActions" group, false to include as object and item. Optional
  - `boolean`

### **Return:**
Return an instance from TypesFromGit interface with toDeploy and toDelete extracted data from git
- `TypesFromGit`

### **Examples:**
```javascript
    import { MetadataFactory } from '@aurahelper/metadata-factory';

    const metadataDetailsResponse = {
                "status": 0,
                "result": {
                    "metadataObjects": [
                    {
                        "directoryName": "installedPackages",
                        "inFolder": false,
                        "metaFile": false,
                        "suffix": "installedPackage",
                        "xmlName": "InstalledPackage"
                    },
                    {
                        "childXmlNames": [
                        "CustomLabel"
                        ],
                        "directoryName": "labels",
                        "inFolder": false,
                        "metaFile": false,
                        "suffix": "labels",
                        "xmlName": "CustomLabels"
                    },
                    {
                        "directoryName": "staticresources",
                        "inFolder": false,
                        "metaFile": true,
                        "suffix": "resource",
                        "xmlName": "StaticResource"
                    },
                    {
                        "directoryName": "scontrols",
                        "inFolder": false,
                        "metaFile": true,
                        "suffix": "scf",
                        "xmlName": "Scontrol"
                    },
                    {
                        "directoryName": "certs",
                        "inFolder": false,
                        "metaFile": true,
                        "suffix": "crt",
                        "xmlName": "Certificate"
                    }
                }
            };

    const metadataDetails = MetadataFactory.createMetadataDetails(metadataDetailsResponse);

    const simulatedGitDiffs = [
        {
            "path": "path/to/edited/file1",
            "mode": "edit file",
            "removeChanges": [
                // Removed lines
            ],
            "addChanges": [
                // added lines
            ]
        },
        {
            "path": "path/to/edited/file2",
            "mode": "edit file",
            "removeChanges": [
                // Removed lines
            ],
            "addChanges": [
                // added lines
            ]
        },
        {
            "path": "path/to/edited/file3",
            "mode": "delete file",
            "removeChanges": [
                // Removed lines
            ]
        },
        {
            ...
        }
        ,
        {
            ...
        }
    ]

    const rootProjectPath = 'path/to/root/project';
    const metadataTypesFromGit = MetadataFactory.createMetadataTypesFromGitDiffs(rootProjectPath, simulatedGitDiffs, metadataDetails);

    for(const metadataTypeAPIName of Object.keys(metadataTypesFromGit)){
        const metadataType = metadataTypesFromGit[metadataTypeAPIName];
        console.log(metadataType);
    }
```
---
## [**deserializeMetadataTypes(jsonDataOrJsonStr, removeEmptyTypes)**](#deserializemetadatatypesjsondataorjsonstr-removeemptytypes)
Method to convert a JSON String with Metadata JSON format or a Metadata JSON untyped Object to a Metadata JSON Object with MetadataType, MetadataObject and MetadataItem objects. See [Metadata JSON Format](#metadata-file) section to understand the JSON Metadata Format.

### **Parameters:**
- **jsonDataOrJsonStr**: String or Object with Metadata JSON format to convert to typed Metadata JSON
  - `string` | `any`
- **gitDiffs**: true to remove types with no data
  - `boolean`

### **Return:**
Return a JSON Metadata Object with MetadataType, MetadataObject and MetadataItem instances insted untyped objects
- `any`

### **Throws:**
This method can throw the next exceptions:

- **`WrongFilePathException`**: If the path is not a String or cant convert to absolute path
- **`FileNotFoundException`**: If the file not exists or not have access to it
- **`InvalidFilePathException`**: If the path is not a file
- **`WrongFormatException`**: If file is not a JSON file or not have the correct Metadata JSON format

### **Examples:**
**Deserialize Metadata Types from untyped object**
```javascript
    import { MetadataFactory } from '@aurahelper/metadata-factory';

    const untypedMetadataObject = {
        CustomObject: {
            name: 'CustomObject',
            childs: {
                Account: {
                    name: 'Account',
                    checked: false,
                    childs: {}
                }
            },
            checked: false,
        },
        CustomField: {
            name: 'CustomField',
            childs: {
                Account: {
                    name: 'Account',
                    checked: false,
                    childs: {
                        Name: {
                            name: 'Name',
                            checked: false
                        }
                    }
                }
            },
            checked: false,
        },
        {
            ...
        }
    }

    const deserializedTypes = MetadataFactory.deserializeMetadataTypes(untypedMetadataObject);

    for(const metadataTypeAPIName of Object.keys(deserializedTypes)){
        const metadataType = deserializedTypes[metadataTypeAPIName];
        console.log(metadataType);
    }
```
# [**Metadata JSON Format**](#metadata-file)

The Metadata JSON Format used by Aura Helper Framework and modules have the next structure. Some fields are required and the datatypes checked to ensure the correct file structure. 

```json
    {
        "MetadataAPIName": {
            "name": "MetadataAPIName",                                  // Required (String). Contains the Metadata Type API Name (like object Key)
            "checked": false,                                           // Required (Boolean). Field for include this type on package or not
            "path": "path/to/the/metadata/folder",                      // Optional (String). Path to the Metadata Type folder in local project
            "suffix": "fileSuffix",                                     // Optional (String). Metadata File suffix
            "childs": {                                                 // Object with a collection of childs (Field required (JSON Object) but can be an empty object)
                "MetadataObjectName":{
                    "name": "MetadataObjectName",                       // Required (String). Contains the Metadata Object API Name (like object Key)
                    "checked": false,                                   // Required (Boolean). Field for include this object on package or not
                    "path": "path/to/the/metadata/file/or/folder",      // Optional (String). Path to the object file or folder path
                    "childs": {                                         // Object with a collection of childs (Field required (JSON Object) but can be an empty object)
                        "MetadataItemName": {
                            "name": "MetadataItemName",                 // Required (String). Contains the Metadata Item API Name (like object Key)
                            "checked": false,                           // Required (Boolean). Field for include this object on package or not
                            "path": "path/to/the/metadata/file"
                        },
                        "MetadataItemName2": {
                            ...
                        },
                        ...,
                        ...,
                        ...
                    }
                }
                "MetadataObjectName2":{
                   ...
                },
                ...,
                ...,
                ...
            }
        }
    }
```
### **Example**:
```json
    {
        "CustomObject": {
            "name": "CustomObject",
            "checked": false,
            "path":  "path/to/root/project/force-app/main/default/objects",
            "suffix": "object",
            "childs": {
                "Account": {
                    "name": "Account",
                    "checked": true,            // Add Account Object to the package
                    "path": "path/to/root/project/force-app/main/default/objects/Account/Account.object-meta.xml",
                    "childs": {}
                },
                "Case": {
                    "name": "Case",
                    "checked": true,            // Add Case Object to the package
                    "path": "path/to/root/project/force-app/main/default/objects/Case/Case.object-meta.xml",
                    "childs": {}
                },
                ...,
                ...,
                ...
            }
        },
        "CustomField": {
            "name": "CustomField",
            "checked": false,
            "path":  "path/to/root/project/force-app/main/default/objects",
            "suffix": "field",
            "childs": {
                "Account": {
                    "name": "Account",
                    "checked": false,            
                    "path": "path/to/root/project/force-app/main/default/objects/Account/fields",
                    "childs": {
                        "customField__c": {
                            "name": "customField__c",
                            "checked": true,    // Add customField__c to the package
                            "path": "path/to/root/project/force-app/main/default/objects/Account/fields/customField__c.field-meta.xml",
                        },
                        ...,
                        ...,
                        ...
                    }
                },
                "Case": {
                    "name": "Case",
                    "checked": false,           
                    "path": "path/to/root/project/force-app/main/default/objects/Case/fields",
                    "childs": {
                        "CaseNumber": {
                            "name": "CaseNumber",
                            "checked": true,    // Add CaseNumber to the package
                            "path": "path/to/root/project/force-app/main/default/objects/Account/fields/CaseNumber.field-meta.xml",
                        },
                        ...,
                        ...,
                        ...
                    }
                },
                ...,
                ...,
                ...
            }
        }
    }
```