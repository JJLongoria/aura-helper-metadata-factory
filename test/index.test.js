const { FileReader } = require('@aurahelper/core').FileSystem;
const MetadataFactory = require('../index');
const fs = require('fs');
const { XMLParser } = require('@aurahelper/languages').XML;

describe('Testing ./src/types/factory.js', () => {
    test('Testing createMetadataDetails()', () => {
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
        const result = MetadataFactory.createMetadataDetails(objects);
        expect(result.length).toEqual(8);
        MetadataFactory.createMetadataDetails('./test/assets/metadataTypes.json');
    });
    test('Testing createSObjectsFromFileSystem()', () => {
        const result = MetadataFactory.createSObjectsFromFileSystem('./test/assets/SFDXProject/force-app/main/default/objects');
        expect(Object.keys(result).length).toEqual(203);
        expect(result['account']).toBeDefined();
    });
    test('Testing createMetadataTypeFromRecords()', () => {
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
        let metadataType = MetadataFactory.createMetadataTypeFromRecords('Report', records, foldersByType, '', true);
        expect(metadataType.name).toEqual('Report');
        expect(metadataType.getChild('folder1').name).toEqual('folder1');
        expect(metadataType.getChild('folder2').name).toEqual('folder2');
        expect(metadataType.getChild('folder1').getChild('devName1').name).toEqual('devName1');
        expect(metadataType.getChild('folder2').getChild('devName2').name).toEqual('devName2');
        metadataType = MetadataFactory.createMetadataTypeFromRecords('EmailTemplate', records, foldersByType, '', true);
        expect(metadataType.name).toEqual('EmailTemplate');
        expect(metadataType.getChild('folder3').name).toEqual('folder3');
        expect(metadataType.getChild('folder3').getChild('devName4').name).toEqual('devName4');
    });
    test('Testing createMetedataTypeFromResponse()', () => {
        const response1 = {
            status: 0,
            result: [
                {
                    fullName: 'Account',
                },
                {
                    fullName: 'Case',
                }
            ]
        }
        const metadataType1 = MetadataFactory.createMetedataTypeFromResponse('CustomObject', response1, '', true);
        expect(metadataType1.name).toEqual('CustomObject');
        expect(metadataType1.getChild('Account').name).toEqual('Account');
        expect(metadataType1.getChild('Case').name).toEqual('Case');
        const response2 = {
            status: 0,
            result: [
                {
                    fullName: 'Account.Name',
                },
                {
                    fullName: 'Account.FirstName',
                }
            ]
        };
        const metadataType2 = MetadataFactory.createMetedataTypeFromResponse('CustomField', response2, '', true);
        expect(metadataType2.name).toEqual('CustomField');
        expect(metadataType2.getChild('Account').name).toEqual('Account');
        expect(metadataType2.getChild('Account').getChild('Name').name).toEqual('Name');
        expect(metadataType2.getChild('Account').getChild('FirstName').name).toEqual('FirstName');
        const response3 = {
            status: 0,
            result: [
                {
                    fullName: 'Account',
                },
                {
                    fullName: 'Case',
                }
            ]
        };
        const metadataType3 = MetadataFactory.createMetedataTypeFromResponse('CustomObject', response3, '', true);
        expect(metadataType3.name).toEqual('CustomObject');
        expect(metadataType3.getChild('Account').name).toEqual('Account');
        expect(metadataType3.getChild('Case').name).toEqual('Case');
        const response4 = {
            status: 0,
            result: [
                {
                    fullName: 'Account.Name',
                },
                {
                    fullName: 'Account.FirstName',
                }
            ]
        };
        const metadataType4 = MetadataFactory.createMetedataTypeFromResponse('CustomField', response4, '', true);
        expect(metadataType4.name).toEqual('CustomField');
        expect(metadataType4.getChild('Account').name).toEqual('Account');
        expect(metadataType4.getChild('Account').getChild('Name').name).toEqual('Name');
        expect(metadataType4.getChild('Account').getChild('FirstName').name).toEqual('FirstName');
        const response5 = {
            status: 0,
            result: [
                {
                    fullName: 'Account-Account_Layout1',
                },
                {
                    fullName: 'Account-Account_Layout2',
                }
            ]
        };
        const metadataType5 = MetadataFactory.createMetedataTypeFromResponse('Layout', response5, '', true);
        expect(metadataType5.name).toEqual('Layout');
        expect(metadataType5.getChild('Account').name).toEqual('Account');
        expect(metadataType5.getChild('Account').getChild('Account_Layout1').name).toEqual('Account_Layout1');
        expect(metadataType5.getChild('Account').getChild('Account_Layout2').name).toEqual('Account_Layout2');

        const response6 = undefined;
        const metadataType6 = MetadataFactory.createMetedataTypeFromResponse('Layout', response6, '', true);
        expect(metadataType6).toBeUndefined();

        const response7 = {
            status: 0,
            result: undefined
        };
        const metadataType7 = MetadataFactory.createMetedataTypeFromResponse('Layout', response7, '', true);
        expect(metadataType7).toBeUndefined();
    });
    test('Testing createNotIncludedMetadataType()', () => {
        const metadataType = MetadataFactory.createNotIncludedMetadataType('StandardValueSet');
        expect(metadataType.name).toEqual('StandardValueSet');
    });
    test('Testing createSObjectFromJSONSchema()', () => {
        const data = fs.readFileSync('./test/assets/describeSObject.json', 'utf8');
        const Sobject = MetadataFactory.createSObjectFromJSONSchema(data);
        expect(Sobject.name).toEqual('acn__Account__c');
        expect(Sobject.getField('acn__Location__c').name).toEqual('acn__Location__c');
    });
    test('Testing createMetadataTypesFromFileSystem()', () => {
        const metadata = JSON.parse(fs.readFileSync('./test/assets/metadataTypes.json', 'utf8'));
        const metadataDetails = MetadataFactory.createMetadataDetails(metadata.result.metadataObjects);
        const folderMetadataMap = MetadataFactory.createFolderMetadataMap(metadataDetails);
        let metadataTypes = MetadataFactory.createMetadataTypesFromFileSystem(folderMetadataMap, './test/assets/SFDXProject');
        metadataTypes = MetadataFactory.deserializeMetadataTypes(metadataTypes, true);
        expect(metadataTypes['CustomObject'].name).toEqual('CustomObject');
        metadataTypes = MetadataFactory.createMetadataTypesFromFileSystem(folderMetadataMap, './test/assets');
        expect(metadataTypes).toEqual({});
    });
    test('Testing createMetadataTypesFromPackageXML()', () => {
        const xmlContent = fs.readFileSync('./test/assets/SFDXProject/manifest/package.xml', 'utf8');
        let metadataTypes = MetadataFactory.createMetadataTypesFromPackageXML(xmlContent);
        expect(metadataTypes['CustomObject'].name).toEqual('CustomObject');
        const xmlRoot = XMLParser.parseXML(xmlContent);
        metadataTypes = MetadataFactory.createMetadataTypesFromPackageXML(xmlRoot);
        expect(metadataTypes['CustomObject'].name).toEqual('CustomObject');
        metadataTypes = MetadataFactory.createMetadataTypesFromPackageXML(undefined);
        expect(metadataTypes).toEqual({});
        metadataTypes = MetadataFactory.createMetadataTypesFromPackageXML('./test/assets/SFDXProject/manifest/package.xml');
        expect(metadataTypes['CustomObject'].name).toEqual('CustomObject');
        try {
            MetadataFactory.createMetadataTypesFromPackageXML('./test/assets/SFDXProject/manifest');
        } catch (error) {
            expect(error.message).toMatch('Not a valid package.xml content. Check the file format');
        }
        try {
            MetadataFactory.createMetadataTypesFromPackageXML({ root: { value: '' } });
        } catch (error) {
            expect(error.message).toMatch('Not a valid package.xml content. Check the file format');
        }
    });
    test('Testing createMetadataTypesFromGitDiffs()', () => {
        const metadata = JSON.parse(fs.readFileSync('./test/assets/metadataTypes.json', 'utf8'));
        const metadataDetails = MetadataFactory.createMetadataDetails(metadata.result.metadataObjects);
        const folderMetadataMap = MetadataFactory.createFolderMetadataMap(metadataDetails);
        let metadataTypes = MetadataFactory.createMetadataTypesFromGitDiffs('./test/assets/SFDXProject', JSON.parse(FileReader.readFileSync('./test/assets/diffOut.json')), folderMetadataMap);
        expect(metadataTypes.toDeploy['ApexComponent']).toBeDefined();
    });
});